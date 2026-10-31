const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadAuth(expoGo, enabled = true, flowResult = {}, facebookEnabled = false, microsoftEnabled = false) {
  const calls = [];
  const errors = [];
  const destinations = [];
  const stateChanges = [];
  let stateIndex = 0;
  const exports = {};
  const mocks = {
    expo: { isRunningInExpoGo: () => expoGo },
    'expo-auth-session': { makeRedirectUri: () => 'acharyaapp:///' },
    'expo-router': { useRouter: () => ({ replace(path) { destinations.push(path); } }) },
    '@/lib/routes': { SIGNED_IN_HOME: '/home' },
    '@clerk/expo': { useSSO: () => ({ startSSOFlow: async (options) => { calls.push(options); return flowResult; } }) },
    react: { useRef: (initial) => ({ current: initial }), useCallback: (fn) => fn, useState: (initial) => {
      const index = stateIndex++;
      return [initial, (value) => { stateChanges.push({ index, value }); if (index === 4) errors.push(value); }];
    } },
  };
  const source = ts.transpileModule(fs.readFileSync('src/hooks/use-social-auth.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, process: { env: { EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: String(enabled), EXPO_PUBLIC_FACEBOOK_AUTH_ENABLED: String(facebookEnabled), EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED: String(microsoftEnabled) } }, require: (name) => {
    assert.ok(name in mocks, `Unexpected import: ${name}`);
    return mocks[name];
  } });
  return { auth: exports.useSocialAuth(), calls, errors, destinations, stateChanges };
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

test('Microsoft has its own gate and preserves the native callback', async () => {
  const disabled = loadAuth(false);
  await disabled.auth.startMicrosoftAuth();
  assert.equal(disabled.calls.length, 0);
  const enabled = loadAuth(false, false, {}, false, true);
  await enabled.auth.startMicrosoftAuth();
  assert.equal(enabled.auth.isMicrosoftAuthAvailable, true);
  assert.equal(enabled.calls[0].strategy, 'oauth_microsoft');
  assert.equal(enabled.calls[0].redirectUrl, 'acharyaapp:///');
});

test('Microsoft is unavailable in Expo Go even with its flag enabled', async () => {
  const { auth, calls } = loadAuth(true, true, {}, true, true);
  await auth.startMicrosoftAuth();
  assert.equal(auth.isMicrosoftAuthAvailable, false);
  assert.equal(calls.length, 0);
});

for (const type of ['cancel', 'dismiss']) {
  test(`Microsoft ${type} does not activate a session or report failure`, async () => {
    const { auth, errors, destinations } = loadAuth(false, true, { authSessionResult: { type } }, true, true);
    await auth.startMicrosoftAuth();
    assert.deepEqual(errors, [null]);
    assert.deepEqual(destinations, []);
  });
}

test('Microsoft activates a completed Clerk session', async () => {
  let activated;
  const { auth, destinations } = loadAuth(false, true, {
    createdSessionId: 'sess_microsoft',
    setActive: async ({ session, navigate }) => {
      activated = session;
      await navigate({ session: { currentTask: null } });
    },
  }, true, true);
  await auth.startMicrosoftAuth();
  assert.equal(activated, 'sess_microsoft');
  assert.deepEqual(destinations, ['/home']);
});

test('a Microsoft signup stays pending until email verification completes', async () => {
  const signUp = { status: 'missing_requirements', missingFields: ['email_address'], unverifiedFields: [], protectCheck: null };
  const { auth, calls, destinations, stateChanges } = loadAuth(false, true, {
    signUp,
    setActive: async ({ navigate }) => { await navigate({ session: { currentTask: null } }); },
  }, true, true);
  await auth.startMicrosoftAuth();
  assert.ok(stateChanges.some(({ value }) => value === signUp));
  await auth.startGoogleAuth();
  assert.equal(calls.length, 1, 'another provider cannot replace the pending signup');
  await assert.rejects(auth.completeMicrosoftSignUp(signUp), /needs more verification/);
  assert.deepEqual(destinations, []);
  await auth.completeMicrosoftSignUp({ status: 'complete', createdSessionId: 'sess_verified' });
  assert.deepEqual(destinations, ['/home']);
});

test('unsupported Microsoft requirements fail closed', async () => {
  const signUp = { status: 'missing_requirements', missingFields: ['phone_number'], unverifiedFields: [], protectCheck: null };
  const { auth, errors, destinations, stateChanges } = loadAuth(false, true, { signUp, setActive: async () => {} }, true, true);
  await auth.startMicrosoftAuth();
  assert.ok(!stateChanges.some(({ value }) => value === signUp));
  assert.equal(errors.at(-1), 'Sign-in needs more steps. Try email instead.');
  assert.deepEqual(destinations, []);
});

test('simultaneous social taps only start one OAuth flow', async () => {
  const { auth, calls } = loadAuth(false, true, {}, true, true);
  await Promise.all([auth.startMicrosoftAuth(), auth.startFacebookAuth()]);
  assert.equal(calls.length, 1);
});
