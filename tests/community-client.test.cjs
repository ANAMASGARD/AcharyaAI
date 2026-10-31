const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, Error, JSON, Map, Set, Promise, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, process: { env: { EXPO_PUBLIC_NEON_FUNCTION_URL: 'https://example.com/mobile' } }, ...globals, require: name => name in mocks ? mocks[name] : require(name) });
  return exports;
}
function client(fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ accepted: true }) })) {
  let nextId = 0;
  return load('src/lib/community/client.ts', { 'expo/fetch': { fetch: fetchImpl }, 'expo-file-system': { File: class {} }, '@/lib/id': { createId: () => String(++nextId).padStart(21,'a') } });
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function session() { let current = true; return { owner: 'alice', getToken: async () => 'token', isCurrent: () => current, switchAccount: () => { current = false; } }; }

// Preserve hook slots and effect dependencies across renders, including renders
// scheduled by loading state and cache updates. Clerk supplies a fresh token
// callback on each render, just as its installed Expo hook does.
function communityRenderHarness(fetchImpl) {
  const slots = []; let index = 0; let dirty = false; let output; let component;
  let layoutEffects = []; let effects = [];
  const auth = { owner: 'alice', token: 'initial-token' };
  const changed = (before, after) => !before || before.length !== after.length || after.some((value, i) => !Object.is(value, before[i]));
  const memo = (create, deps) => {
    const i = index++;
    if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: create(), deps };
    return slots[i].value;
  };
  const effect = queue => (create, deps) => {
    const i = index++;
    if (!slots[i] || changed(slots[i].deps, deps)) {
      const previous = slots[i];
      const slot = slots[i] = { deps };
      queue.push(() => { previous?.cleanup?.(); slot.cleanup = create(); });
    }
  };
  const react = {
    useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps),
    useRef(value) { const i = index++; return slots[i] ??= { current: value }; },
    useState(value) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: typeof value === 'function' ? value() : value };
      return [slots[i].value, next => {
        const value = typeof next === 'function' ? next(slots[i].value) : next;
        if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; }
      }];
    },
    useLayoutEffect: (create, deps) => effect(layoutEffects)(create, deps),
    useEffect: (create, deps) => effect(effects)(create, deps),
  };
  let state = cache();
  state.update = (owner, update) => { if (owner === state.owner) { state = { ...state, ...update(state) }; dirty = true; } };
  state.setOwner = owner => { state = { ...cache(), owner, update: state.update, setOwner: state.setOwner }; dirty = true; };
  const useStore = selector => selector ? selector(state) : state; useStore.getState = () => state;
  const mocks = { react, 'expo-router': { useFocusEffect: fn => react.useEffect(fn, [fn]) },
    '@clerk/expo': { useAuth: () => { const token = auth.token; return { userId: auth.owner, getToken: async () => token }; } },
    '@/lib/community/client': client(fetchImpl), '@/store/community-remote-store': { useCommunityRemoteStore: useStore } };
  const community = load('src/hooks/use-community.ts', mocks);
  const groups = load('src/hooks/use-community-groups.ts', { ...mocks, '@/hooks/use-community': community });
  function render(next = component) {
    component = next; index = 0; dirty = false; layoutEffects = []; effects = [];
    output = component();
    layoutEffects.forEach(run => run()); effects.forEach(run => run());
    return output;
  }
  return { auth, community, groups, render,
    async settle() {
      for (let attempts = 0; attempts < 20; attempts++) {
        await flush();
        if (!dirty) return output;
        render();
      }
      throw new Error('Community effects keep scheduling renders instead of settling.');
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('groups refresh settles after success or failure despite changing Clerk token callbacks', async t => {
  for (const succeeds of [true, false]) await t.test(succeeds ? 'success' : 'failure', async () => {
    let calls = 0; const tokens = [];
    const h = communityRenderHarness(async (_url, options) => {
      calls++; tokens.push(options.headers.Authorization);
      return { ok: succeeds, status: succeeds ? 200 : 503, json: async () => succeeds ? { groups: [{ groupId: 'teachers' }] } : { message: 'Community unavailable' } };
    });
    try {
      h.render(h.groups.useCommunityGroups);
      const first = await h.settle();
      assert.equal(calls, 1); assert.equal(first.isLoading, false);
      assert.equal(first.error, succeeds ? null : 'Community unavailable');
      assert.equal(first.groups.length, succeeds ? 1 : 0);
      h.auth.token = 'refreshed-token'; h.render();
      const next = await h.settle();
      assert.equal(calls, 1); assert.equal(next.refresh, first.refresh);
      await next.refresh(); await h.settle();
      assert.equal(calls, 2); assert.deepEqual(tokens, ['Bearer initial-token', 'Bearer refreshed-token']);
    } finally { h.unmount(); }
  });
});

test('community session stays stable with current tokens and invalidates on account switch or unmount', async () => {
  const h = communityRenderHarness();
  const alice = h.render(h.community.useCommunitySession);
  assert.equal(alice.isCurrent(), true);
  h.auth.token = 'new-token';
  assert.equal(h.render(), alice); assert.equal(await alice.getToken(), 'new-token');
  h.auth.owner = 'bob'; const bob = h.render();
  assert.equal(alice.isCurrent(), false); assert.equal(bob.isCurrent(), true);
  h.auth.owner = 'alice'; const returned = h.render();
  assert.notEqual(returned, alice); assert.equal(alice.isCurrent(), false);
  assert.equal(bob.isCurrent(), false); assert.equal(returned.isCurrent(), true);
  h.auth.owner = null; assert.equal(h.render(), null); assert.equal(returned.isCurrent(), false);
  h.auth.owner = 'alice'; const signedIn = h.render();
  h.unmount(); assert.equal(signedIn.isCurrent(), false);
});

test('failed draft retry and concurrent submission reuse one creation ID until acknowledgement', async () => {
  const api = client(); const auth = session(); const ids = []; let calls = 0;
  const create = async id => { ids.push(id); if (++calls === 1) throw new Error('offline'); return { id }; };
  await assert.rejects(api.communityCreation(auth,'post',{ title: 'Plants' },create), /offline/);
  const first = api.communityCreation(auth,'post',{ title: 'Plants' },create);
  const second = api.communityCreation(auth,'post',{ title: 'Plants' },create);
  assert.equal(first,second); await first;
  assert.equal(ids[0],ids[1]); assert.equal(calls,2);
  await api.communityCreation(auth,'post',{ title: 'Plants' },create);
  assert.notEqual(ids[1],ids[2]);
});
test('account switch rejects stale successful responses and blocks old callbacks before HTTP', async () => {
  let finish; let calls = 0;
  const api = client(async () => { calls++; await new Promise(resolve => { finish = resolve; }); return { ok: true, status: 200, json: async () => ({ accepted: true }) }; });
  const auth = session(); const request = api.communityRequest(auth,'/posts');
  await flush(); auth.switchAccount(); finish();
  await assert.rejects(request,/account changed/);
  await assert.rejects(api.communityRequest(auth,'/posts'),/account changed/);
  assert.equal(calls,1);
});
test('transport aborts outstanding requests when account state is cleared', async () => {
  let sent;
  const api = client(async (_url,options) => { sent = options; return new Promise((_resolve,reject) => options.signal.addEventListener('abort',() => reject(new Error('aborted')))); });
  const promise = api.communityRequest(session(),'/posts'); await flush();
  api.cancelCommunityRequests(); await assert.rejects(promise,/aborted/); assert.equal(sent.signal.aborted,true);
});
test('storage quota failure remains actionable and never acknowledges a publication', async () => {
  const api = client(async () => ({ ok: false, status: 503, json: async () => ({}) }));
  await assert.rejects(api.communityRequest(session(),'/uploads',{ method: 'POST', bytes: new ArrayBuffer(1) }),/temporarily unavailable/);
});
test('chat refresh deduplicates messages, stops in background, and aborts on blur', async () => {
  let focused; let tick; let onState; let calls = 0; let removed = false; let activeRequest;
  const auth = session();
  let state = { owner: 'alice', messages: {} };
  const store = { getState: () => ({ update: (owner,update) => { if (state.owner === owner) state = { ...state, ...update(state) }; } }) };
  const appState = { currentState: 'active', addEventListener: (_event, listener) => { onState = listener; return { remove: () => { removed = true; } }; } };
  const community = { state, request: async (_path,options) => { calls++; activeRequest = options.signal; return { messages: [{ messageId: 'm1', createdAt: '2026-10-20T10:00:00Z' }], hasMore: false, nextCursor: null }; } };
  const api = client();
  load('src/hooks/use-group-chat.ts', { 'expo-router': { useFocusEffect: effect => { focused = effect(); } }, react: { useCallback: value => value, useRef: value => ({ current: value }), useState: value => [value, () => {}] }, 'react-native': { AppState: appState },
    '@/hooks/use-community': { useCommunity: () => community, useCommunitySession: () => auth }, '@/lib/community/client': api, '@/store/community-remote-store': { useCommunityRemoteStore: store } },
    { setInterval: callback => { tick = callback; return 1; }, clearInterval: () => {} }).useGroupChat('group');
  tick(); tick();
  await flush(); assert.equal(calls,1);
  tick(); await flush(); assert.equal(state.messages.group.length,1);
  appState.currentState = 'background'; tick(); assert.equal(calls,2);
  appState.currentState = 'active'; onState('active'); await flush(); assert.equal(calls,3);
  focused(); assert.equal(activeRequest.aborted,true); assert.equal(removed,true);
});
test('dashboard metrics use saved reports and leave unverifiable notes unavailable', () => {
  const { dashboardFromReports } = load('src/hooks/use-home-dashboard.ts', { '@clerk/expo': {}, 'expo-router': {}, react: {}, '@/lib/reports/history': {}, '@/lib/calendar/date-utils': { toDateKey: date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` }, '@/lib/community/time-ago': {} });
  const reports = [{ sessionId: 'one', topic: 'Plants', subject: 'Science', classLevel: '6', recordedAt: '2026-10-21T10:00:00Z', score: 70 },
    { sessionId: 'two', topic: 'Fractions', subject: 'Math', classLevel: '6', recordedAt: '2026-10-22T10:00:00Z', score: 90 }];
  const dashboard = dashboardFromReports(reports,new Date('2026-10-22T12:00:00Z'));
  assert.equal(dashboard.stats.classesThisWeek,2); assert.equal(dashboard.stats.averageScore,80); assert.equal(dashboard.stats.notesVerifiedCount,null); assert.equal(dashboard.stats.streakDays,2); assert.equal(dashboard.recentActivity[0].title,'Fractions');
});
test('post cache changes only after a matching server acknowledgement; failed acknowledgement keeps retry ID', async () => {
  const auth = session();
  const bodies = [];
  const api = client(async (_url, options) => {
    const body = JSON.parse(options.body); bodies.push(body);
    return { ok: true, status: 200, json: async () => ({ post: { postId: bodies.length === 1 ? 'wrong-id' : body.postId, createdAt: '2026-10-22T12:00:00Z' } }) };
  });
  let state = { owner: 'alice', invalidationRevision: 0, posts: [], groups: [], comments: {}, messages: {}, groupDetails: {}, feeds: {}, deniedPosts: {}, deniedGroups: {}, revokedImages: {}, blockedAuthors: {} };
  state.update = (owner, update) => { if (owner === state.owner) state = { ...state, ...update(state) }; };
  state.setOwner = owner => { state = { ...state, owner }; };
  const useStore = () => state; useStore.getState = () => state;
  const hooks = load('src/hooks/use-community.ts', { 'expo-router': { useFocusEffect: () => {} },'@clerk/expo': { useAuth: () => ({ userId: 'alice', getToken: auth.getToken }) }, react: { useMemo: fn => fn(), useRef: value => ({ current: value }), useEffect: () => {}, useLayoutEffect: fn => fn() },
    '@/lib/community/client': api, '@/store/community-remote-store': { useCommunityRemoteStore: useStore } });
  const community = hooks.useCommunity();
  const input = { title: 'Plants', body: 'Classroom idea', displayName: 'Alice', subjectTag: 'Science', images: [] };
  await assert.rejects(community.createPost(input),/acknowledgement/); assert.equal(state.posts.length,0);
  await community.createPost(input); assert.equal(state.posts.length,1); assert.equal(bodies[0].postId,bodies[1].postId);
});
test('photo upload keeps durable attachment identity and rejects a mismatched upload acknowledgement', async () => {
  const uploads = [];
  const api = client(async (url,options) => {
    if (url.startsWith('blob:')) return { arrayBuffer: async () => new ArrayBuffer(4) };
    uploads.push(options);
    return { ok: true, status: 200, json: async () => ({ image: { imageId: 'wrong-id' } }) };
  });
  const id = 'z'.repeat(21);
  await assert.rejects(api.uploadCommunityImages(session(),[{ id, uri: 'blob:photo', name: 'photo.png', mimeType: 'image/png', sizeBytes: 4 }],'x'.repeat(21)),/acknowledgement/);
  assert.equal(uploads[0].headers['X-Community-Image-Id'],id);
  assert.equal(uploads[0].headers['Content-Type'],'image/png');
});
test('cancellation rejects a stalled Clerk token lookup before any HTTP request', async () => {
  let requests = 0;
  const api = client(async () => { requests++; });
  const auth = session(); auth.getToken = () => new Promise(() => {});
  const request = api.communityRequest(auth,'/posts');
  api.cancelCommunityRequests(); await assert.rejects(request,/cancelled/); assert.equal(requests,0);
});
function cacheModule() { return load('src/store/community-remote-store.ts', { zustand: { create: initializer => initializer(() => {}) } }); }
function cache(overrides = {}) { return { owner: 'alice', invalidationRevision: 0, posts: [], groups: [], comments: {}, messages: {}, groupDetails: {}, feeds: {}, deniedPosts: {}, deniedGroups: {}, revokedImages: {}, blockedAuthors: {}, ...overrides }; }
function post(postId,groupId = null,authorClerkId = 'teacher') { return { postId,groupId,authorClerkId,images: [{ imageId: `image-${postId}` }],createdAt: `2026-10-22T12:${String(postId).padStart(2,'0')}:00Z` }; }
test('Home feed refresh preserves full-feed page membership and cached posts', () => {
  const api = cacheModule();
  const all = Array.from({ length: 20 },(_,index) => post(String(index)));
  const fullKey = api.communityFeedKey(null,20), homeKey = api.communityFeedKey(null,2);
  let state = cache();
  state = { ...state, ...api.applyCommunityFeedPage(state,fullKey,{ posts: all,nextCursor: 'older',hasMore: true },false) };
  state = { ...state, ...api.applyCommunityFeedPage(state,homeKey,{ posts: all.slice(0,2),nextCursor: 'home-older',hasMore: true },false) };
  assert.equal(state.posts.length,20); assert.equal(state.feeds[fullKey].ids.length,20); assert.equal(state.feeds[homeKey].ids.length,2);
});
test('group revocation purges private posts, comments, chat, membership and signed-photo state', () => {
  const api = cacheModule(); const privatePost = post('private','private-group'), publicPost = post('public');
  let state = cache({ posts: [privatePost,publicPost], groups: [{ groupId: 'private-group' }], groupDetails: { 'private-group': { groupId: 'private-group' } },
    comments: { private: [{ commentId: 'comment',authorClerkId: 'teacher' }] }, messages: { 'private-group': [{ messageId: 'message',authorClerkId: 'teacher',images: [{ imageId: 'chat-photo' }] }] } });
  state = api.invalidateCommunityCache(state,{ groupId: 'private-group' });
  assert.deepEqual(Array.from(state.posts,post => post.postId),['public']); assert.equal(state.groups.length,0); assert.equal(state.comments.private,undefined); assert.equal(state.messages['private-group'],undefined); assert.equal(state.groupDetails['private-group'],undefined);
  assert.equal(state.revokedImages['image-private'],true); assert.equal(state.revokedImages['chat-photo'],true);
  state = api.sanitizeCommunityCache({ ...state,posts: [...state.posts,privatePost] }); assert.equal(state.posts.length,1);
});
test('blocking a teacher purges all their cached content and marks its image URLs unusable', () => {
  const api = cacheModule();
  let state = cache({ posts: [post('blocked',null,'blocked'),post('allowed')], comments: { allowed: [{ commentId: 'blocked-comment',authorClerkId: 'blocked' }] },
    messages: { group: [{ messageId: 'blocked-message',authorClerkId: 'blocked',images: [{ imageId: 'blocked-chat-photo' }] }] } });
  state = api.invalidateCommunityCache(state,{ clerkId: 'blocked' });
  assert.equal(state.posts.length,1); assert.equal(state.comments.allowed.length,0); assert.equal(state.messages.group.length,0); assert.equal(state.revokedImages['image-blocked'],true); assert.equal(state.revokedImages['blocked-chat-photo'],true);
  state = api.sanitizeCommunityCache({ ...state,posts: [...state.posts,post('blocked-again',null,'blocked')] }); assert.equal(state.posts.length,1);
});
function remoteHarness(fetchImpl,initial = {},localStates = []) {
  const policies = cacheModule(); const transport = client(fetchImpl);
  let state = cache(initial);
  state.update = (owner,update) => { if (owner === state.owner) state = policies.sanitizeCommunityCache({ ...state,...update(state) }); };
  state.invalidate = (owner,target) => { if (owner === state.owner) state = policies.invalidateCommunityCache(state,target); };
  state.setOwner = owner => { state = { ...cache(),owner,...{ update: state.update,invalidate: state.invalidate,setOwner: state.setOwner } }; };
  const useStore = selector => selector ? selector(state) : state; useStore.getState = () => state;
  const react = { useMemo: fn => fn(),useCallback: fn => fn,useRef: value => ({ current: value }),useEffect: () => {},useLayoutEffect: fn => fn(),useState: value => [localStates.length ? localStates.shift() : value,() => {}] };
  const hooks = load('src/hooks/use-community.ts', { 'expo-router': { useFocusEffect: () => {} },'@clerk/expo': { useAuth: () => ({ userId: 'alice',getToken: async () => 'token' }) },react,
    '@/lib/community/client': transport,'@/store/community-remote-store': { useCommunityRemoteStore: useStore } });
  return { hooks,community: hooks.useCommunity(),getState: () => state,invalidate: target => state.invalidate('alice',target) };
}
test('403 post access and 404 group access discard cached private content through the public client API', async () => {
  for (const [path,status] of [['/posts/private',403],['/groups/private-group',404]]) {
    const h = remoteHarness(async () => ({ ok: false,status,json: async () => ({ error: 'FORBIDDEN' }) }), { posts: [post('private','private-group')],groups: [{ groupId: 'private-group' }],messages: { 'private-group': [{ messageId: 'message',images: [] }] } });
    await assert.rejects(h.community.request(path),/FORBIDDEN/);
    assert.equal(h.getState().posts.length,0); assert.equal(h.getState().messages['private-group'],undefined); assert.equal(h.getState().revokedImages['image-private'],true);
  }
});
test('a response started before blocking or group revocation cannot repopulate the cache', async () => {
  let finish;
  const h = remoteHarness(async () => { await new Promise(resolve => { finish = resolve; }); return { ok: true,status: 200,json: async () => ({ group: { groupId: 'private-group' } }) }; });
  const pending = h.community.getGroup('private-group'); await flush(); h.invalidate({ groupId: 'private-group' }); finish();
  await assert.rejects(pending,/access changed/); assert.equal(h.getState().groupDetails['private-group'],undefined);
});
test('group-route changes mask previous pagination status and ignore delayed older-group responses', async () => {
  const slots = []; let index = 0; let lastFocus; let cleanup; let finishOlder; let finishNew;
  const react = {
    useRef(value) { const i = index++; if (!slots[i]) slots[i] = { current: value }; return slots[i]; },
    useState(value) { const i = index++; if (slots[i] === undefined) slots[i] = value; return [slots[i],next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback(fn,deps) { const i = index++; if (!slots[i] || deps.some((value,n) => value !== slots[i].deps[n])) slots[i] = { value: fn,deps }; return slots[i].value; },
  };
  const auth = session(); let state = { owner: 'alice',messages: {} };
  const request = async path => {
    if (path.includes('cursor=')) { await new Promise(resolve => { finishOlder = resolve; }); return { messages: [{ messageId: 'old-late',createdAt: '2026-10-22T09:00:00Z' }],nextCursor: 'older-a',hasMore: true }; }
    if (path.includes('/new/')) { await new Promise(resolve => { finishNew = resolve; }); return { messages: [{ messageId: 'new-message',createdAt: '2026-10-22T10:00:00Z' }],nextCursor: null,hasMore: false }; }
    return { messages: [{ messageId: 'old-message',createdAt: '2026-10-22T10:00:00Z' }],nextCursor: 'cursor-a',hasMore: true };
  };
  const hooks = load('src/hooks/use-group-chat.ts', { react,'expo-router': { useFocusEffect: fn => { if (lastFocus !== fn) { cleanup?.(); lastFocus = fn; cleanup = fn(); } } },
    'react-native': { AppState: { currentState: 'active',addEventListener: () => ({ remove() {} }) } },'@/hooks/use-community': { useCommunitySession: () => auth,useCommunity: () => ({ request,state }) },
    '@/lib/community/client': client(),'@/store/community-remote-store': { useCommunityRemoteStore: { getState: () => ({ update: (_owner,update) => { state = { ...state,...update(state) }; } }) } } },
    { setInterval: () => 1,clearInterval() {} });
  const render = groupId => { index = 0; return hooks.useGroupChat(groupId); };
  render('old'); await flush(); const previous = render('old'); assert.equal(previous.hasMore,true);
  const oldPage = previous.loadMore(); await flush();
  const next = render('new'); assert.equal(next.hasMore,false); assert.equal(next.error,null); assert.equal(next.messages.length,0);
  finishOlder(); await oldPage; assert.equal(state.messages.old.some(message => message.messageId === 'old-late'),false);
  finishNew(); await flush(); const loaded = render('new'); assert.equal(loaded.hasMore,false); assert.equal(loaded.messages[0].messageId,'new-message'); cleanup();
});
test('signed image hook masks an already loaded URI immediately after revocation', () => {
  const h = remoteHarness(async () => { throw new Error('No request expected during render'); },{ revokedImages: { private: true } },[
    { owner: 'alice',imageId: 'private',uri: 'https://images.example.com/private.jpg?signed=temporary',expiresAt: '2099-10-22T12:00:00Z' },null,
  ]);
  const photo = h.hooks.useCommunityImage('private');
  assert.equal(photo.uri,null); assert.match(photo.error,/no longer available/);
});
