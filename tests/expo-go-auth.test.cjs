const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadAuth(expoGo, enabled = true, flowResult = {}, facebookEnabled = false) {
  const calls = [];
  const errors = [];
  const destinations = [];
  const exports = {};
  const mocks = {
    expo: { isRunningInExpoGo: () => expoGo },
    'expo-auth-session': { makeRedirectUri: () => 'acharyaapp:///' },
    'expo-router': { useRouter: () => ({ replace(path) { destinations.push(path); } }) },
    '@/lib/routes': { SIGNED_IN_HOME: '/home' },
    '@clerk/expo': { useSSO: () => ({ startSSOFlow: async (options) => { calls.push(options); return flowResult; } }) },
    react: { useCallback: (fn) => fn, useState: (initial) => [initial, (value) => { if (initial === null) errors.push(value); }] },
  };
  const source = ts.transpileModule(fs.readFileSync('src/hooks/use-social-auth.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, process: { env: { EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: String(enabled), EXPO_PUBLIC_FACEBOOK_AUTH_ENABLED: String(facebookEnabled) } }, require: (name) => {
    assert.ok(name in mocks, `Unexpected import: ${name}`);
    return mocks[name];
  } });
  return { auth: exports.useSocialAuth(), calls, errors, destinations };
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

test("unconfigured Google cannot start OAuth in a standalone build", async () => { const { auth, calls } = loadAuth(false, false); assert.equal(auth.isSocialAuthAvailable, false); await auth.startGoogleAuth(); assert.equal(calls.length, 0); });

for (const type of ['cancel', 'dismiss']) {
  test(`Google ${type} leaves the auth page without a failure message`, async () => {
    const { auth, errors, destinations } = loadAuth(false, true, { authSessionResult: { type } });
    await auth.startGoogleAuth();
    assert.deepEqual(errors, [null]);
    assert.deepEqual(destinations, []);
  });
}

test('Google activates the returned session before navigating home', async () => {
  let activatedSession;
  const { auth, destinations } = loadAuth(false, true, {
    createdSessionId: 'sess_google',
    setActive: async ({ session, navigate }) => {
      activatedSession = session;
      await navigate({ session: { currentTask: null } });
    },
  });
  await auth.startGoogleAuth();
  assert.equal(activatedSession, 'sess_google');
  assert.deepEqual(destinations, ['/home']);
});


test('Facebook has an independent configuration gate', async () => {
  const disabled = loadAuth(false, true);
  await disabled.auth.startFacebookAuth();
  assert.equal(disabled.calls.length, 0);
  const enabled = loadAuth(false, false, {}, true);
  assert.equal(enabled.auth.isSocialAuthAvailable, false);
  assert.equal(enabled.auth.isFacebookAuthAvailable, true);
  await enabled.auth.startFacebookAuth();
  assert.equal(enabled.calls[0].strategy, 'oauth_facebook');
  assert.equal(enabled.calls[0].redirectUrl, 'acharyaapp:///');
});

test('Facebook does not open OAuth in Expo Go', async () => {
  const { auth, calls } = loadAuth(true, true, {}, true);
  await auth.startFacebookAuth();
  assert.equal(auth.isFacebookAuthAvailable, false);
  assert.equal(calls.length, 0);
});

test('Facebook activates the Clerk session before entering the app', async () => {
  let activated;
  const { auth, destinations } = loadAuth(false, true, {
    createdSessionId: 'sess_facebook',
    setActive: async ({ session, navigate }) => {
      activated = session;
      await navigate({ session: { currentTask: null } });
    },
  }, true);
  await auth.startFacebookAuth();
  assert.equal(activated, 'sess_facebook');
  assert.deepEqual(destinations, ['/home']);
});
