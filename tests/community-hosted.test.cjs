const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createClerkClient } = require('@clerk/backend');
const fs = require('node:fs');

const origin = process.env.COMMUNITY_HOSTED_TEST_URL;
const testingOrigin = 'https://br-steep-recipe-b3ujia3w-acharya.compute.c-4.ap-southeast-1.aws.neon.tech';
const testPhotos = process.env.COMMUNITY_HOSTED_MEDIA_TEST === '1';

// Opt-in only: creates synthetic Clerk development accounts and removes their
// data through the deployed account-deletion flow. Never targets production.
test('hosted community: verified teachers share feed/chat and private groups enforce membership', { skip: !origin, timeout: testPhotos ? 480_000 : 180_000 }, async () => {
  assert.equal(origin, testingOrigin, 'Hosted writes are restricted to the isolated testing project.');
  assert.match(process.env.CLERK_SECRET_KEY ?? '', /^sk_test_/);
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const accounts = [];
  let expiryProbe;
  const id = () => randomBytes(16).toString('base64url').slice(0, 21);
  const suffix = randomBytes(6).toString('hex');
  async function api(account, path, method = 'GET', body, status = 200) {
    const token = await clerk.sessions.getToken(account.sessionId);
    const response = await fetch(origin + path, {
      method, headers: { Authorization: `Bearer ${token.jwt}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
    return result;
  }
  async function upload(account, groupId) {
    const token = await clerk.sessions.getToken(account.sessionId);
    const response = await fetch(origin + '/community/uploads', { method: 'POST', headers: {
      Authorization: `Bearer ${token.jwt}`, 'Content-Type': 'image/png', 'X-Community-Image-Id': id(), 'X-Community-File-Name': 'community-test.png',
      ...(groupId ? { 'X-Community-Group-Id': groupId } : {}),
    }, body: fs.readFileSync('assets/images/favicon.png'), signal: AbortSignal.timeout(60_000) });
    const result = await response.json(); assert.equal(response.status, 200, `Photo upload: ${JSON.stringify(result)}`);
    return result.image;
  }
  async function verifyDelivery(account, imageId) {
    const signed = await api(account, `/community/images/${imageId}?width=360`);
    const expires = new Date(signed.expiresAt).getTime();
    assert(expires > Date.now() && expires <= Date.now() + 301_000);
    const response = await fetch(signed.url, { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200); assert.match(response.headers.get('Content-Type'), /^image\//); await response.arrayBuffer();
    const unsigned = new URL(signed.url); unsigned.searchParams.delete('ik-s'); unsigned.searchParams.delete('ik-t');
    const denied = await fetch(unsigned, { signal: AbortSignal.timeout(30_000) });
    assert([401, 403].includes(denied.status), 'Unsigned delivery must fail.');
    await denied.arrayBuffer();
    expiryProbe ??= { account, imageId, signed };
  }
  try {
    for (const name of ['alice', 'bob', 'outsider']) {
      const user = await clerk.users.createUser({
        emailAddress: [`acharya-community-${name}-${suffix}+clerk_test@example.com`],
        firstName: 'Community test', skipPasswordRequirement: true,
        privateMetadata: { acharyaCommunitySmokeTest: true },
      });
      const account = { userId: user.id }; accounts.push(account);
      account.sessionId = (await clerk.sessions.createSession({ userId: user.id })).id;
    }
    const [alice, bob, outsider] = accounts;
    const developmentToken = await clerk.sessions.getToken(alice.sessionId);
    const production = await fetch('https://br-icy-resonance-b3camzf0-acharya.compute.c-4.ap-southeast-1.aws.neon.tech/community/posts', {
      headers: { Authorization: `Bearer ${developmentToken.jwt}` }, signal: AbortSignal.timeout(30_000),
    });
    assert.equal(production.status, 401, 'Production must reject development identities.');
    for (const headers of [{}, { Authorization: 'Bearer forged' }]) {
      const response = await fetch(origin + '/community/posts', { headers, signal: AbortSignal.timeout(30_000) });
      assert.equal(response.status, 401);
    }
    const preflight = await fetch(origin + '/community/posts', { method: 'OPTIONS', headers: {
      Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type',
    }, signal: AbortSignal.timeout(30_000) });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
    const publicPhoto = testPhotos ? await upload(alice) : null;
    const post = { postId: id(), title: 'Hosted community test', body: 'Synthetic teaching discussion', subjectTag: 'Science', displayName: 'Test Alice', images: publicPhoto ? [{ imageId: publicPhoto.imageId }] : [], linkUrl: 'https://example.com/lesson' };
    await api(alice, '/community/posts', 'POST', post);
    await api(alice, '/community/posts', 'POST', post);
    await api(alice, '/community/posts', 'POST', { ...post, title: 'Conflicting retry' }, 409);
    const feed = await api(bob, '/community/posts');
    assert.equal(feed.posts.filter(item => item.postId === post.postId).length, 1);
    if (publicPhoto) { assert.equal(feed.posts.find(item => item.postId === post.postId).images[0].imageId, publicPhoto.imageId); await verifyDelivery(bob, publicPhoto.imageId); }
    await api(bob, `/community/posts/${post.postId}`, 'DELETE', undefined, 403);
    const comment = { commentId: id(), body: 'Try an experiment', displayName: 'Test Bob' };
    await api(bob, `/community/posts/${post.postId}/comments`, 'POST', comment);
    await api(bob, `/community/posts/${post.postId}/comments`, 'POST', comment);
    await Promise.all([api(alice, `/community/posts/${post.postId}/vote`, 'PUT', { value: -1 }), api(bob, `/community/posts/${post.postId}/vote`, 'PUT', { value: 1 })]);
    const detail = await api(alice, `/community/posts/${post.postId}`);
    assert.equal(detail.post.score, 0); assert.equal(detail.comments.filter(item => item.commentId === comment.commentId).length, 1);
    assert.equal((await api(bob, `/community/posts/${post.postId}/save`, 'PUT', { save: true })).viewerSaved, true);
    const groupId = id();
    const { group } = await api(alice, '/community/groups', 'POST', { groupId, name: 'Hosted test group', description: 'Synthetic members', displayName: 'Test Alice' });
    await api(outsider, `/community/groups/${groupId}`, 'GET', undefined, 404);
    await api(outsider, `/community/groups/${groupId}/messages`, 'GET', undefined, 404);
    await api(bob, '/community/groups/join', 'POST', { code: group.joinCode, displayName: 'Test Bob' });
    const chatPhoto = testPhotos ? await upload(bob, groupId) : null;
    const message = { messageId: id(), body: 'Hello fellow teacher', displayName: 'Test Bob', images: chatPhoto ? [{ imageId: chatPhoto.imageId }] : [] };
    await Promise.all([api(bob, `/community/groups/${groupId}/messages`, 'POST', message), api(bob, `/community/groups/${groupId}/messages`, 'POST', message)]);
    assert.equal((await api(alice, `/community/groups/${groupId}/messages`)).messages.length, 1);
    if (chatPhoto) { await verifyDelivery(alice, chatPhoto.imageId); await api(outsider, `/community/images/${chatPhoto.imageId}`, 'GET', undefined, 404); }
    const second = { ...message, messageId: id(), body: 'A second message', images: [] };
    await api(alice, `/community/groups/${groupId}/messages`, 'POST', second);
    const recent = await api(bob, `/community/groups/${groupId}/messages?limit=1`);
    assert.equal(recent.hasMore, true); assert.equal(recent.messages.length, 1);
    const older = await api(bob, `/community/groups/${groupId}/messages?limit=1&cursor=${encodeURIComponent(recent.nextCursor)}`);
    assert.equal(older.messages.length, 1); assert.notEqual(recent.messages[0].messageId, older.messages[0].messageId);
    const groupPhoto = testPhotos ? await upload(alice, groupId) : null;
    const privatePost = { ...post, postId: id(), groupId, images: groupPhoto ? [{ imageId: groupPhoto.imageId }] : [] };
    await api(alice, '/community/posts', 'POST', privatePost);
    assert((await api(bob, `/community/posts?groupId=${groupId}`)).posts.some(item => item.postId === privatePost.postId));
    if (groupPhoto) { await verifyDelivery(bob, groupPhoto.imageId); await api(outsider, `/community/images/${groupPhoto.imageId}`, 'GET', undefined, 404); }
    await api(outsider, `/community/posts/${privatePost.postId}`, 'GET', undefined, 404);
    await api(alice, `/community/groups/${groupId}/members/${bob.userId}`, 'DELETE');
    await api(bob, `/community/groups/${groupId}/messages`, 'GET', undefined, 404);
    if (chatPhoto) await api(bob, `/community/images/${chatPhoto.imageId}`, 'GET', undefined, 404);
    await api(bob, '/community/groups/join', 'POST', { code: group.joinCode, displayName: 'Test Bob' }, 404);
    await api(outsider, '/community/moderation', 'GET', undefined, 403);
    if (expiryProbe) {
      // Exercise real CDN expiry rather than inferring it from a timestamp.
      await new Promise(resolve => setTimeout(resolve, Math.max(0, new Date(expiryProbe.signed.expiresAt).getTime() + 1500 - Date.now())));
      const expired = await fetch(expiryProbe.signed.url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      assert([401, 403].includes(expired.status), 'An expired signed CDN URL must fail.'); await expired.arrayBuffer();
      const renewed = await api(expiryProbe.account, `/community/images/${expiryProbe.imageId}?width=360`);
      assert(new Date(renewed.expiresAt).getTime() > new Date(expiryProbe.signed.expiresAt).getTime());
      const refreshed = await fetch(renewed.url, { signal: AbortSignal.timeout(30_000) });
      assert.equal(refreshed.status, 200); await refreshed.arrayBuffer();
    }
  } finally {
    const failures = [];
    for (const account of accounts) {
      try {
        if (account.sessionId) await api(account, '/account', 'DELETE');
        else await clerk.users.deleteUser(account.userId);
      } catch (error) { failures.push(error); }
    }
    assert.equal(failures.length, 0, 'Synthetic account/data cleanup must succeed.');
  }
});
