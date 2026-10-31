const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function config(env = {}, dev = false) {
  const source = fs.readFileSync('src/lib/clerk-config.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, process: { env }, __DEV__: dev };
  vm.runInNewContext(code, context);
  return context.exports;
}

const testKey = 'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk';
const liveKey = 'pk_live_Y2xlcmsuZXhhbXBsZS5jb20k';

function bootstrap(env, dev) {
  const clerk = config(env, dev);
  const key = clerk.getClerkPublishableKey();
  clerk.assertClerkKeyAllowedForRelease(clerk.isClerkReleaseBuild(), key);
  return key;
}

test('installed internal APK accepts its bundled development Clerk key without Metro', () => {
  for (const variant of [undefined, 'preview', 'development']) {
    assert.equal(bootstrap({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: testKey, EXPO_PUBLIC_APP_VARIANT: variant }, false), testKey);
  }
});

test('store build requires a production key even when EAS_BUILD_PROFILE is unavailable at runtime', () => {
  assert.throws(() => bootstrap({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: testKey, EXPO_PUBLIC_APP_VARIANT: 'production' }, false), /development key/);
  assert.equal(bootstrap({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: liveKey, EXPO_PUBLIC_APP_VARIANT: 'production' }, false), liveKey);
});

test('missing and secret keys cannot initialize Clerk', () => {
  for (const key of [undefined, '', 'sk_test_doNotBundleSecrets', 'bad-key']) {
    assert.throws(() => bootstrap({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: key }, false));
  }
});

test('EAS production profile uses Play app-bundle and explicit public production variant', () => {
  const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_APP_VARIANT, 'production');
});
