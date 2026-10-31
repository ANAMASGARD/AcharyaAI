const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const crypto = require('node:crypto');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, process: { env: {} }, require: (name) => {
    if (!(name in mocks)) throw Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  } });
  return exports;
}
const providers = load('src/lib/ai-keys/providers.ts');
function harness({ platform = 'ios', available = true, set, remove, get, persistedValues } = {}) {
  const values = persistedValues ?? new Map();
  const calls = [];
  const vault = load('src/lib/ai-keys/vault.ts', {
    './providers': providers,
    '@/lib/ai/cancellation': { cancelAiRequests: () => {} },
    'react-native': { Platform: { OS: platform } },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_, input) => crypto.createHash('sha256').update(input).digest('hex') },
    'expo-secure-store': {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 42,
      isAvailableAsync: async () => available,
      setItemAsync: async (key, value, options) => { calls.push({ kind: 'save', key, options }); if (set) await set(key); values.set(key, value); },
      getItemAsync: async (key, options) => { calls.push({ kind: 'read', key, options }); if (get) return get(key); return values.get(key) ?? null; },
      deleteItemAsync: async (key, options) => { calls.push({ kind: 'delete', key, options }); if (remove) await remove(key); values.delete(key); },
    },
  });
  return { vault, values, calls };
}
test('provider keys use account-isolated device-only secure storage; UI summary never returns secrets', async () => {
  const { vault, calls, values } = harness();
  for (const { id } of providers.aiProviders) await vault.saveProviderCredential('alice', id, { apiKey: 'alice-secret' });
  await vault.saveProviderCredential('bob', 'gnani', { apiKey: 'bob-secret' });
  assert.equal(values.size, 6);
  assert.equal((await vault.getProviderSummary('alice', 'gnani')).configured, true);
  assert.equal(JSON.stringify(await vault.getProviderSummary('alice', 'gnani')).includes('secret'), false);
  assert.equal((await vault.getProviderSummary('bob', 'gemini')).configured, false);
  for (const call of calls) {
    assert.match(call.key, /^byok\.v1\.[a-f0-9]{64}\.(gnani|openai|gemini|claude|active)$/);
    assert.equal(call.options.keychainAccessible, 42);
    assert.equal(call.options.keychainService, 'acharya.byok.v1');
  }
  await vault.clearProviderCredentials('alice');
  assert.equal(values.size, 1);
  assert.equal((await vault.getProviderSummary('bob', 'gnani')).configured, true);
});
test('replacement updates one record; failed writes preserve previous credential and redact errors', async () => {
  let fail = false;
  const { vault, values } = harness({ set: async () => { if (fail) throw Error('native log contains secret'); } });
  await vault.saveProviderCredential('alice', 'gemini', { apiKey: 'first' });
  await vault.saveProviderCredential('alice', 'gemini', { apiKey: 'second' });
  assert.equal(values.size, 2);
  assert.equal(JSON.parse([...values.values()][0]).apiKey, 'second');
  fail = true;
  await assert.rejects(vault.saveProviderCredential('alice', 'gemini', { apiKey: 'third' }), error => !error.message.includes('secret'));
  assert.equal(JSON.parse([...values.values()][0]).apiKey, 'second');
  await vault.removeProviderCredential('alice', 'gemini');
  assert.equal((await vault.getProviderSummary('alice', 'gemini')).configured, false);
});
test('cleanup waits for queued saves and attempts every provider when one deletion fails', async () => {
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  const { vault, values, calls } = harness({ set: () => gate, remove: async key => { if (key.endsWith('.claude')) throw Error('private error'); } });
  const save = vault.saveProviderCredential('alice', 'gnani', { apiKey: 'sample' });
  const clearing = vault.clearProviderCredentials('alice');
  unblock();
  await save;
  await assert.rejects(clearing, /Could not remove all API keys/);
  assert.equal(values.size, 0);
  assert.equal(calls.filter(call => call.kind === 'delete').length, 5);
});
test('browser, unavailable encrypted storage, and empty owner fail closed without plaintext fallback', async () => {
  for (const options of [{ platform: 'web' }, { available: false }]) {
    const { vault, calls } = harness(options);
    await assert.rejects(vault.saveProviderCredential('alice', 'gnani', { apiKey: 'sample' }), /only in the Android and iOS app/);
    assert.equal(calls.length, 0);
  }
  await assert.rejects(harness().vault.saveProviderCredential('', 'gnani', { apiKey: 'sample' }), /Sign in/);
});
test('malformed saved keys and native read errors do not reveal contents', async () => {
  for (const value of ['not-json-secret', '{}', '{"apiKey": 5}', '{"apiKey": " "}']) {
    await assert.rejects(harness({ get: () => value }).vault.getProviderSummary('alice', 'gemini'), /Could not read the saved key/);
  }
  await assert.rejects(harness({ get: () => { throw Error('private-data'); } }).vault.getProviderSummary('alice', 'gemini'), error => !error.message.includes('private-data'));
});
test('compatible endpoints require HTTPS and cannot contain embedded credentials or query secrets', () => {
  for (const baseUrl of ['http://example.com/v1', 'https://user:pass@example.com/v1', 'https://example.com/v1?key=secret', 'https://example.com/#secret', 'invalid']) {
    assert.throws(() => providers.validateCredential('openai', { apiKey: 'sample', baseUrl }), /HTTPS/);
  }
  assert.equal(providers.validateCredential('openai', { apiKey: ' sample ', baseUrl: 'https://example.com/v1/' }).baseUrl, 'https://example.com/v1');
  assert.equal(providers.validateCredential('openai', { apiKey: 'sample' }).baseUrl, 'https://api.openai.com/v1');
  for (const apiKey of ['', 'x\ny', 'a b', 'a'.repeat(1025), '秘密']) assert.throws(() => providers.validateCredential('gnani', { apiKey }), /API key/);
});
test('settings credential modules have no network, logs, public secrets, or plaintext persistence', () => {
  for (const path of ['src/lib/ai-keys/providers.ts', 'src/lib/ai-keys/vault.ts', 'src/components/profile/provider-key-card.tsx']) {
    const source = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|console\.|AsyncStorage|localStorage|expo-sqlite|expo-file-system|process\.env/);
  }
  const card = fs.readFileSync('src/components/profile/provider-key-card.tsx', 'utf8');
  assert.match(card, /secureTextEntry/);
  assert.match(card, /autoComplete="off"/);
  const actions = fs.readFileSync('src/hooks/use-account-actions.ts', 'utf8');
  assert.ok(actions.indexOf('await clearProviderCredentials(user.id)') < actions.indexOf('await user.delete()'));
  assert.match(fs.readFileSync('src/lib/ui-preview/account.ts', 'utf8'), /clearProviderCredentials\(owner\)/);
});

test('a fresh app runtime reads the same encrypted credentials and selected provider', async () => {
  const first = harness({ platform: 'android' });
  await first.vault.saveProviderCredential('alice', 'gemini', { apiKey: 'saved-key', model: 'gemini-model' });
  await first.vault.saveProviderCredential('bob', 'gnani', { apiKey: 'other-account-key' });
  const updatedApp = harness({ platform: 'android', persistedValues: first.values });
  assert.equal((await updatedApp.vault.getProviderCredential('alice', 'gemini')).apiKey, 'saved-key');
  assert.equal(await updatedApp.vault.getActiveProvider('alice'), 'gemini');
  assert.equal((await updatedApp.vault.getProviderSummary('bob', 'gemini')).configured, false);
  assert.equal(updatedApp.calls.some(({ kind }) => kind === 'delete' || kind === 'save'), false);
});

test('sign-out/session cleanup retains encrypted keys; account deletion removes only its own keys', async () => {
  const keys = new Set(['alice', 'bob']);
  const calls = [];
  const account = load('src/lib/ui-preview/account.ts', {
    '@/lib/embeddings/indexing': { stopReportIndexing: async (owner) => calls.push(['stop-index', owner]) },
    '@/lib/reports/cloud': { stopReportSync: (owner) => calls.push(['stop', owner]), clearReportSync: async (owner) => calls.push(['clear-sync', owner]) },
    '@/lib/ai-keys/vault': { clearProviderCredentials: async (owner) => { keys.delete(owner); calls.push(['erase-keys', owner]); } },
    '@/lib/ai/cancellation': { cancelAiRequests: (owner) => calls.push(['cancel-ai', owner]) },
    '@/lib/recording/lifecycle': { clearRecorderAccount: async (owner) => calls.push(['clear-recordings', owner]) },
    './lifecycle': { createPreviewLifecycle: (clear) => ({ clear }) },
    './storage': { previewStorage: { clearAccount: async (owner, preferences) => calls.push(['clear-drafts', owner, preferences]) } },
  });
  await account.clearUiPreviewAccount('alice');
  assert.equal(keys.has('alice'), true);
  assert.equal(keys.has('bob'), true);
  assert.ok(calls.some(([kind, owner]) => kind === 'cancel-ai' && owner === 'alice'));
  assert.ok(calls.some(([kind, , preferences]) => kind === 'clear-drafts' && preferences === false));
  await account.clearUiPreviewAccount('alice', true);
  assert.equal(keys.has('alice'), false);
  assert.equal(keys.has('bob'), true);
  assert.ok(calls.some(([kind, owner]) => kind === 'clear-recordings' && owner === 'alice'));
});

function accountActionsHarness() {
  const calls = [];
  const keys = new Set(['alice', 'bob']);
  const actions = load('src/hooks/use-account-actions.ts', {
    '@/lib/reports/cloud': { cloudConfigured: () => false, deleteCloudAccount: async () => assert.fail('No configured cloud'), stopReportSync() {} },
    '@/lib/ai-keys/vault': { clearProviderCredentials: async (owner) => { keys.delete(owner); calls.push('erase-keys'); } },
    '@/lib/ai/cancellation': { cancelAiRequests: () => calls.push('cancel-ai') },
    '@/lib/recording/lifecycle': { stopRecorderAccount: async () => {} },
    '@/lib/recording/api': { deleteRecordingAccount: async () => assert.fail('No legacy backend') },
    '@clerk/expo': {
      useAuth: () => ({ isSignedIn: true, userId: 'alice', getToken: async () => '' }),
      useClerk: () => ({ signOut: async () => calls.push('sign-out') }),
      useUser: () => ({ user: { id: 'alice', delete: async () => calls.push('delete-user') } }),
    },
    'expo-router': { useRouter: () => ({ replace() {} }) },
    react: { useCallback: (fn) => fn, useState: (initial) => [initial, () => {}] },
    '@/lib/confirm-action': { confirmAction: async () => true },
    '@/lib/ui-preview/account': { clearUiPreviewAccount: async () => {} },
  });
  return { actions: actions.useAccountActions(), calls, keys };
}

test('explicit sign-out cancels pending AI work and keeps both accounts encrypted keys', async () => {
  const h = accountActionsHarness();
  h.actions.signOut();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual([...h.keys], ['alice', 'bob']);
  assert.ok(h.calls.indexOf('cancel-ai') < h.calls.indexOf('sign-out'));
  assert.equal(h.calls.includes('erase-keys'), false);
});

test('explicit account deletion still erases its keys before deleting the Clerk account', async () => {
  const h = accountActionsHarness();
  h.actions.deleteAccount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.keys.has('alice'), false);
  assert.equal(h.keys.has('bob'), true);
  assert.ok(h.calls.indexOf('erase-keys') < h.calls.indexOf('delete-user'));
});

test('saved keys can be explicitly revealed and the last saved reasoning provider becomes active', async () => {
  const { vault } = harness();
  await vault.saveProviderCredential('alice', 'gemini', { apiKey: 'example', model: 'gemini-test' });
  assert.equal((await vault.getProviderCredential('alice', 'gemini')).apiKey, 'example');
  assert.equal(await vault.getActiveProvider('alice'), 'gemini');
  await vault.saveProviderCredential('alice', 'openai', { apiKey: 'another', model: 'custom/model', baseUrl: 'https://example.com/v1' });
  assert.equal(await vault.getActiveProvider('alice'), 'openai');
  await vault.setActiveProvider('alice', 'gemini');
  assert.equal(await vault.getActiveProvider('alice'), 'gemini');
  await assert.rejects(vault.getProviderCredential('bob', 'gemini'), /Add your/);
  await assert.rejects(vault.setActiveProvider('alice', 'claude'), /Save a key/);
  await vault.clearProviderCredentials('alice');
  await assert.rejects(vault.getActiveProvider('alice'), /Save a Gemini/);
});

test('model-only selection preserves the secret and endpoint without switching accounts or active provider', async () => {
  const { vault } = harness();
  await vault.saveProviderCredential('alice', 'openai', { apiKey: 'private', baseUrl: 'https://example.com/v1', model: 'old-model' });
  await vault.saveProviderCredential('alice', 'gemini', { apiKey: 'gemini-private' });
  await vault.updateProviderModel('alice', 'openai', 'new-model');
  const saved = await vault.getProviderCredential('alice', 'openai');
  assert.equal(saved.apiKey, 'private'); assert.equal(saved.baseUrl, 'https://example.com/v1'); assert.equal(saved.model, 'new-model');
  assert.equal(await vault.getActiveProvider('alice'), 'gemini');
  await assert.rejects(vault.updateProviderModel('bob', 'openai', 'new-model'), /Could not save/);
  await assert.rejects(vault.updateProviderModel('alice', 'openai', 'invalid model'), /Could not save/);
  assert.equal((await vault.getProviderSummary('alice', 'openai')).model, 'new-model');
});
