const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');

function loadValidation() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/community/validation.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL });
  return exports;
}
const validation = loadValidation();
test('community input rejects injected URLs, duplicate photos, oversized lists and invalid cursors', () => {
  for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:password@example.com']) assert.throws(() => validation.communityLink(value));
  assert.equal(validation.communityLink('https://example.com/lesson'), 'https://example.com/lesson');
  const imageId = 'a'.repeat(21);
  assert.throws(() => validation.communityImages([{ imageId }, { imageId }]));
  assert.throws(() => validation.communityImages(Array.from({ length: 5 }, () => ({ imageId }))));
  assert.throws(() => validation.communityId('bad-id'));
  assert.throws(() => validation.communityCursor('{"createdAt":"yesterday","id":"' + imageId + '"}'));
  assert.throws(() => validation.communityPage(new URLSearchParams('limit=51')));
  assert.throws(() => validation.communityPage(new URLSearchParams('limit=-1')));
  const cursor = JSON.stringify({ createdAt: '2026-10-22T12:00:00.123456+05:30', id: imageId });
  assert.equal(validation.communityCursor(cursor).createdAt, JSON.parse(cursor).createdAt);
});

function loadHandler() {
  const exports = {}, operations = [];
  class MediaError extends Error {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/community/index.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, Response, URL, TextDecoder, Error, process: { env: { COMMUNITY_MODERATOR_IDS: 'user_moderator' } },
    require(name) {
      if (name === 'nanoid') return { nanoid: () => 'z'.repeat(21) };
      if (name === './validation') return validation;
      if (name === './db') return { communityOperation: async (...args) => { operations.push(args); return { acknowledged: true, nextCursor: { id: 'a'.repeat(21), createdAt: '2026-10-22T12:00:00Z' } }; } };
      if (name === '../recording/request-body') return { readRecordingBody: async request => new Uint8Array(await request.arrayBuffer()) };
      if (name === './media-validation') return { CommunityMediaError: MediaError };
      if (name === './media') return { uploadCommunityImage: async () => ({ image: { imageId: 'a'.repeat(21) } }), signCommunityImage: async () => ({ url: 'https://images.example/signed', expiresAt: 'soon' }) };
      throw new Error(name);
    },
  });
  return { ...exports, operations };
}

test('community routing derives identity, restricts metadata and validates unsupported writes before SQL', async () => {
  const handler = loadHandler();
  const request = (path, method, body) => new Request('https://api.example/mobile/community' + path, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const postId = 'a'.repeat(21);
  let response = await handler.handleCommunityRequest(request('/posts', 'POST', { postId, title: 'Science', displayName: 'Teacher', owner: 'user_attacker', moderator: true }), 'user_alice');
  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json()).nextCursor, 'string');
  assert.equal(handler.operations[0][0], 'user_alice');
  assert.equal(handler.operations[0][1], 'post_create');
  assert.equal(handler.operations[0][2].owner, undefined);
  assert.equal(handler.operations[0][2].moderator, undefined);
  response = await handler.handleCommunityRequest(request('/posts/' + postId + '/vote', 'PUT', { value: 100 }), 'user_alice');
  assert.equal(response.status, 400); assert.equal(handler.operations.length, 1);
  response = await handler.handleCommunityRequest(request('/groups/' + postId + '/messages', 'POST', { messageId: 'b'.repeat(21), body: '', images: [], displayName: 'Teacher' }), 'user_alice');
  assert.equal(response.status, 400); assert.equal(handler.operations.length, 1);
  response = await handler.handleCommunityRequest(request('/capabilities', 'GET'), 'user_alice');
  assert.equal((await response.json()).moderator, false);
  response = await handler.handleCommunityRequest(request('/capabilities', 'GET'), 'user_moderator');
  assert.equal((await response.json()).moderator, true);
  response = await handler.handleCommunityRequest(request('/uploads', 'POST', {}), 'user_alice');
  assert.equal(response.status, 200);
  response = await handler.handleCommunityRequest(request('/images/' + postId, 'GET'), 'user_alice');
  assert.equal(response.status, 200);
  const pageCursor = JSON.stringify({ id: postId, createdAt: '2026-10-22T12:00:00.123456+05:30' });
  response = await handler.handleCommunityRequest(request('/posts?cursor=' + encodeURIComponent(pageCursor), 'GET'), 'user_alice');
  assert.equal(response.status, 200);
  assert.equal(handler.operations.at(-1)[1], 'posts_list');
  assert.equal(handler.operations.at(-1)[2].cursor.createdAt, JSON.parse(pageCursor).createdAt);
  const responseCursor = (await response.json()).nextCursor;
  response = await handler.handleCommunityRequest(request('/groups/' + postId + '/messages?cursor=' + encodeURIComponent(responseCursor), 'GET'), 'user_alice');
  assert.equal(response.status, 200);
  assert.equal(handler.operations.at(-1)[1], 'messages_list');
  assert.equal(handler.operations.at(-1)[2].cursor.id, postId);
  assert.equal(handler.communityErrorResponse(new Error('RATE_LIMIT')).status, 429);
  assert.equal(handler.communityErrorResponse(new Error('ACCOUNT_DELETED')).status, 403);
});

const database = process.env.COMMUNITY_TEST_DATABASE_URL;
// This opt-in URL MUST point to a disposable database with 0001 and 0004 applied.
test('isolated PostgreSQL: shared content, ACLs, idempotency, votes, media, moderation and cleanup', { skip: !database }, () => {
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  const sql = text => execFileSync('psql', [database, '-XAt', '-v', 'ON_ERROR_STOP=1', '-c', text], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const id = () => randomBytes(16).toString('base64url').slice(0, 21);
  const suffix = randomBytes(5).toString('hex'), alice = 'user_alice' + suffix, bob = 'user_bob' + suffix, outsider = 'user_other' + suffix;
  function operation(who, action, data = {}, moderator = false, cleanup = false) {
    const result = sql(`BEGIN; SET LOCAL ROLE acharya_runtime; SELECT set_config('app.clerk_user_id',${quote(who)},true),set_config('app.community_moderator',${quote(String(moderator))},true),set_config('app.community_cleanup',${quote(String(cleanup))},true); SELECT acharya.community_operation(${quote(action)},${quote(JSON.stringify(data))}::jsonb); COMMIT;`);
    return JSON.parse(result.split('\n').find(line => line.startsWith('{')));
  }
  const postId = id(), post = { postId, title: 'Fractions', body: 'How do you teach fractions?', subjectTag: 'Math', linkUrl: null, groupId: null, displayName: 'Alice', images: [] };
  assert.equal(operation(alice, 'post_create', post).post.postId, postId);
  assert.equal(operation(alice, 'post_create', post).post.postId, postId);
  assert.throws(() => operation(alice, 'post_create', { ...post, title: 'Changed' }), /CONFLICT/);
  assert(operation(bob, 'posts_list').posts.some(p => p.postId === postId));
  assert.throws(() => operation(bob, 'post_delete', { id: postId }), /FORBIDDEN/);
  assert.equal(operation(bob, 'post_vote', { id: postId, value: 1 }).score, 1);
  assert.equal(operation(bob, 'post_vote', { id: postId, value: 1 }).score, 1);
  assert.equal(operation(alice, 'post_vote', { id: postId, value: -1 }).score, 0);
  assert.equal(operation(bob, 'post_vote', { id: postId, value: -1 }).score, -2);
  assert.equal(operation(bob, 'post_save', { id: postId, save: true }).viewerSaved, true);
  const comment = { id: postId, commentId: id(), body: 'Try a pizza diagram', displayName: 'Bob' };
  operation(bob, 'comment_create', comment); operation(bob, 'comment_create', comment);
  assert.equal(operation(alice, 'post_get', { id: postId }).comments.length, 1);
  const atomicImageId = id(), atomicPostId = id();
  const atomicImage = operation(alice, 'media_prepare', { imageId: atomicImageId, format: 'png', contentHash: 'c'.repeat(64), sizeBytes: 50 }).image;
  operation(alice, 'media_register', { imageId: atomicImageId, fileId: 'file-' + atomicImageId, filePath: atomicImage.filePath, width: 10, height: 10, format: 'png', sizeBytes: 50 });
  assert.throws(() => operation(alice, 'post_create', { ...post, postId: atomicPostId, images: [{ imageId: atomicImageId }, { imageId: id() }] }), /INVALID_MEDIA/);
  assert.throws(() => operation(alice, 'post_get', { id: atomicPostId }), /NOT_FOUND/);
  assert.equal(operation(alice, 'media_access', { imageId: atomicImageId }).image.status, 'pending');
  assert.equal(operation(alice, 'post_create', { ...post, postId: atomicPostId, images: [{ imageId: atomicImageId }] }).post.images.length, 1);
  const groupId = id(), code = id();
  const group = { groupId, name: 'Classroom', description: 'Teachers only', subjectTag: 'Math', displayName: 'Alice', joinCode: code };
  operation(alice, 'group_create', group);
  assert.equal(operation(alice, 'group_create', { ...group, joinCode: id() }).group.joinCode, code);
  assert.throws(() => operation(outsider, 'group_get', { groupId }), /NOT_FOUND/);
  assert.throws(() => operation(outsider, 'messages_list', { groupId }), /NOT_FOUND/);
  operation(bob, 'group_join', { code, displayName: 'Bob' });
  assert.equal(operation(bob, 'group_get', { groupId }).group.memberCount, 2);
  const privatePostId = id();
  operation(alice, 'post_create', { ...post, postId: privatePostId, groupId });
  assert.throws(() => operation(outsider, 'post_get', { id: privatePostId }), /NOT_FOUND/);
  const imageId = id(), prepare = { imageId, groupId, format: 'jpeg', contentHash: 'a'.repeat(64), sizeBytes: 100 };
  const image = operation(bob, 'media_prepare', prepare).image;
  assert.equal(image.status, 'pending');
  assert.throws(() => operation(alice, 'media_access', { imageId }), /NOT_FOUND/);
  assert.throws(() => operation(bob, 'media_prepare', { ...prepare, contentHash: 'b'.repeat(64) }), /CONFLICT/);
  operation(bob, 'media_register', { imageId, fileId: 'file-' + imageId, filePath: image.filePath, width: 20, height: 30, format: 'jpeg', sizeBytes: 100 });
  const messageId = id(), message = { groupId, messageId, body: '', linkUrl: null, displayName: 'Bob', images: [{ imageId }] };
  operation(bob, 'message_create', message); operation(bob, 'message_create', message);
  assert.equal(operation(alice, 'media_access', { imageId }).image.status, 'attached');
  assert.throws(() => operation(outsider, 'media_access', { imageId }), /NOT_FOUND/);
  assert.throws(() => operation(outsider, 'media_access', { imageId }, true), /NOT_FOUND/, 'moderator cannot inspect unreported private photos');
  const photoReportId = id();
  operation(alice, 'report_create', { reportId: photoReportId, targetType: 'message', targetId: messageId, reason: 'Review this photo' });
  const photoReport = operation(outsider, 'moderation_list', {}, true).reports.find(report => report.reportId === photoReportId);
  assert.equal(photoReport.images[0].imageId, imageId);
  assert.equal(operation(outsider, 'media_access', { imageId }, true).image.imageId, imageId);
  operation(outsider, 'moderation_action', { id: photoReportId, action: 'dismiss' }, true);
  assert.throws(() => operation(outsider, 'media_access', { imageId }, true), /NOT_FOUND/, 'closed reports do not authorize future photo URLs');
  for (let i = 0; i < 3; i++) operation(alice, 'message_create', { ...message, messageId: id(), body: 'Message ' + i, displayName: 'Alice', images: [] });
  const page = operation(bob, 'messages_list', { groupId, limit: 2 });
  assert.equal(page.messages.length, 2); assert.equal(page.hasMore, true);
  assert(Date.parse(page.messages[0].createdAt) <= Date.parse(page.messages[1].createdAt));
  const older = operation(bob, 'messages_list', { groupId, limit: 2, cursor: page.nextCursor });
  assert.equal(older.messages.length, 2); assert(!older.messages.some(m => page.messages.some(p => p.messageId === m.messageId)));
  assert.throws(() => operation(bob, 'member_remove', { groupId, id: alice, joinCode: id() }), /FORBIDDEN/);
  operation(alice, 'member_remove', { groupId, id: bob, joinCode: id() });
  assert.throws(() => operation(bob, 'media_access', { imageId }), /NOT_FOUND/);
  assert.throws(() => operation(bob, 'group_join', { code, displayName: 'Bob' }), /NOT_FOUND/);
  operation(bob, 'block', { id: alice });
  assert(!operation(bob, 'posts_list').posts.some(p => p.postId === postId));
  assert.equal(operation(bob, 'blocks_list').blocks[0].clerkId, alice);
  operation(bob, 'unblock', { id: alice });
  const reportId = id(); operation(bob, 'report_create', { reportId, targetType: 'post', targetId: postId, reason: 'Unhelpful' });
  assert.throws(() => operation(bob, 'moderation_list'), /FORBIDDEN/);
  assert(operation(outsider, 'moderation_list', {}, true).reports.some(r => r.reportId === reportId));
  operation(outsider, 'moderation_action', { id: reportId, action: 'remove' }, true);
  assert.throws(() => operation(alice, 'post_get', { id: postId }), /NOT_FOUND/);
  // Deleting a group owner must also enqueue another teacher's images inside that group.
  operation(alice, 'account_delete');
  const jobs = operation('user_systemCleanup', 'media_cleanup_claim', { limit: 10 }, false, true).jobs;
  const job = jobs.find(j => j.imageId === imageId); assert(job);
  assert.throws(() => operation('user_systemCleanup', 'media_cleanup_complete', { jobId: job.jobId, leaseToken: 'stale' }, false, true), /CONFLICT/);
  operation('user_systemCleanup', 'media_cleanup_complete', { jobId: job.jobId, leaseToken: job.leaseToken }, false, true);
  assert(!operation('user_systemCleanup', 'media_cleanup_claim', { limit: 10 }, false, true).jobs.some(j => j.imageId === imageId));
  sql(`UPDATE acharya.accounts SET community_request_count=240,community_window_started_at=clock_timestamp() WHERE owner=${quote(bob)};`);
  assert.throws(() => operation(bob, 'posts_list'), /RATE_LIMIT/);
  assert.equal(operation(bob, 'account_delete').deleted, true, 'deletion remains available while rate limited');
  sql(`UPDATE acharya.accounts SET deleted_at=clock_timestamp() WHERE owner=${quote(bob)};`);
  assert.throws(() => operation(bob, 'post_create', { ...post, postId: id(), displayName: 'Bob' }), /ACCOUNT_DELETED/);
  assert.throws(() => sql('BEGIN; SET LOCAL ROLE acharya_runtime; SELECT * FROM acharya.community_media; COMMIT;'), /permission denied/);
  assert.equal(sql("SELECT pg_has_role('acharya_runtime','acharya_community_service','MEMBER');").trim(), 'f');
  assert.equal(sql("SELECT bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE relnamespace='acharya'::regnamespace AND relname LIKE 'community_%' AND relkind='r';").trim(), 't');
});
