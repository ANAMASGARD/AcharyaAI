/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function worker() {
  const calls = [], module = { exports: {} }, operation = async () => ({});
  const mocks = {
    './db': { systemCleanupOperation: operation },
    './index': { communityErrorResponse: () => Response.json({ error: 'RETRY_LATER' }, { status: 503 }) },
    './media': { cleanupCommunityMedia: async (...args) => { calls.push(args); return { completed: 2, failed: 1 }; } },
    '../recording/request-body': { readRecordingBody: async request => new Uint8Array(await request.arrayBuffer()) },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/server/community/cleanup.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), module, module.exports);
  return { handler: module.exports.handleCommunityCleanup, scheduled: module.exports.handleCommunityScheduledCleanup, calls, operation, mocks };
}
const secret = 'scheduler-credential-'.repeat(3);
async function configured(value, action) {
  const old = process.env.COMMUNITY_CLEANUP_SECRET;
  if (value === undefined) delete process.env.COMMUNITY_CLEANUP_SECRET;
  else process.env.COMMUNITY_CLEANUP_SECRET = value;
  try { await action(); }
  finally { if (old === undefined) delete process.env.COMMUNITY_CLEANUP_SECRET; else process.env.COMMUNITY_CLEANUP_SECRET = old; }
}
function request(authorization, method = 'POST') {
  return new Request('https://api.test/internal/community-cleanup', { method, ...(authorization ? { headers: { Authorization: authorization } } : {}) });
}

test('trusted cleanup requires a configured strong scheduler credential and POST', async () => {
  const { handler, calls } = worker();
  for (const value of [undefined, 'too-short']) await configured(value, async () => assert.equal((await handler(request(`Bearer ${secret}`))).status, 503));
  await configured(secret, async () => assert.equal((await handler(request(`Bearer ${secret}`, 'GET'))).status, 405));
  assert.equal(calls.length, 0);
});

test('Clerk sessions, moderator identities, missing/wrong schemes and credentials cannot run cleanup', async () => {
  const { handler, calls } = worker();
  await configured(secret, async () => {
    for (const authorization of [null, 'Bearer wrong', 'Bearer clerk-session-jwt', 'Bearer user_moderator', secret, `Basic ${secret}`, `Bearer ${secret} extra`]) {
      const response = await handler(request(authorization));
      assert.equal(response.status, 401, `unexpected authorization: ${authorization}`);
      assert.deepEqual(await response.json(), { error: 'UNAUTHORIZED' });
    }
  });
  assert.equal(calls.length, 0);
});

test('valid scheduler runs bounded cross-account operation without teacher claims', async () => {
  const { handler, calls, operation } = worker();
  await configured(secret, async () => {
    const response = await handler(request(`Bearer ${secret}`));
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { completed: 2, failed: 1 });
  });
  assert.equal(calls.length, 1); assert.equal(calls[0][0], ''); assert.equal(calls[0][1], 5);
  assert.equal(calls[0][2].operation, operation);
});

test('scheduler service failures are redacted and retryable', async () => {
  const { handler, mocks } = worker();
  mocks['./media'].cleanupCommunityMedia = async () => { throw new Error('database credentials must not leak'); };
  await configured(secret, async () => {
    const response = await handler(request(`Bearer ${secret}`));
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'RETRY_LATER' });
  });
});

async function triggerConfigured(action) {
  const previous = process.env.COMMUNITY_NEON_TRIGGER_ID;
  process.env.COMMUNITY_NEON_TRIGGER_ID = 'trigger-fixture';
  try { await configured(secret, action); }
  finally { if (previous === undefined) delete process.env.COMMUNITY_NEON_TRIGGER_ID; else process.env.COMMUNITY_NEON_TRIGGER_ID = previous; }
}
const triggerEnvelope = () => ({ version: 1, invocation_id: 'occurrence', trigger: { id: 'trigger-fixture', type: 'schedule' }, data: { scheduled_at: new Date().toISOString() } });
const triggerRequest = (body = triggerEnvelope(), headers = { 'X-Neon-Trigger-Invocation-Id': 'occurrence' }) => new Request('https://api.test/internal/community-cleanup-trigger', { method: 'POST', headers, body: JSON.stringify(body) });

test('Neon scheduled cleanup requires edge attestation, pinned trigger and a recent valid occurrence', async () => {
  const { scheduled, calls } = worker();
  await triggerConfigured(async () => {
    assert.equal((await scheduled(triggerRequest(undefined, {}))).status, 401);
    for (const body of [null, {}, { ...triggerEnvelope(), version: 2 }, { ...triggerEnvelope(), invocation_id: '' },
      { ...triggerEnvelope(), trigger: { id: 'trigger-other', type: 'schedule' } },
      { ...triggerEnvelope(), data: { scheduled_at: 'invalid' } },
      { ...triggerEnvelope(), data: { scheduled_at: new Date(Date.now() - 660_000).toISOString() } },
      { ...triggerEnvelope(), data: { scheduled_at: new Date(Date.now() + 60_000).toISOString() } }]) {
      assert.equal((await scheduled(triggerRequest(body))).status, 401);
    }
  });
  assert.equal(calls.length, 0);
});

test('verified Neon schedule uses the same bounded cross-account cleanup worker', async () => {
  const { scheduled, calls } = worker();
  await triggerConfigured(async () => {
    const response = await scheduled(triggerRequest());
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { completed: 2, failed: 1 });
  });
  assert.equal(calls.length, 1); assert.equal(calls[0][1], 5);
});

test('Neon schedule fails closed when not configured and rejects other HTTP methods', async () => {
  const { scheduled, calls } = worker();
  assert.equal((await scheduled(new Request('https://api.test/internal/community-cleanup-trigger'))).status, 405);
  await triggerConfigured(async () => configured(undefined, async () => assert.equal((await scheduled(triggerRequest())).status, 503)));
  assert.equal(calls.length, 0);
});
