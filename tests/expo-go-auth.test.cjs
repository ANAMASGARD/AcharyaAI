const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadAuth(expoGo, enabled = true) {
  const calls = [];
  const exports = {};
  const mocks = {
    expo: { isRunningInExpoGo: () => expoGo },
    'expo-auth-session': { makeRedirectUri: () => 'acharyaapp:///' },
    'expo-router': { useRouter: () => ({ replace() {} }) },
    '@/lib/routes': { SIGNED_IN_HOME: '/home' },
    '@clerk/expo': { useSSO: () => ({ startSSOFlow: async (options) => { calls.push(options); return {}; } }) },
    react: { useCallback: (fn) => fn, useState: (initial) => [initial, () => {}] },
  };
  const source = ts.transpileModule(fs.readFileSync('src/hooks/use-social-auth.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, process: { env: { EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: String(enabled) } }, require: (name) => {
    assert.ok(name in mocks, `Unexpected import: ${name}`);
    return mocks[name];
  } });
  return { auth: exports.useSocialAuth(), calls };
}

test('Expo Go never opens an unsupported OAuth redirect', async () => {
  const { auth, calls } = loadAuth(true);
  assert.equal(auth.isSocialAuthAvailable, false);
  await auth.startGoogleAuth();
  assert.equal(calls.length, 0);
});

test('development and standalone builds retain social sign-in', async () => {
  const { auth, calls } = loadAuth(false);
  assert.equal(auth.isSocialAuthAvailable, true);
  await auth.startGoogleAuth();
  assert.deepEqual(calls.map((call) => call.strategy), ['oauth_google']);
});

test("unconfigured Google is hidden even in a standalone build", async () => { const { auth, calls } = loadAuth(false, false); assert.equal(auth.isSocialAuthAvailable, false); await auth.startGoogleAuth(); assert.equal(calls.length, 0); });
