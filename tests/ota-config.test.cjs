const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function config(env) {
  const code = ts.transpileModule(fs.readFileSync('app.config.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, process: { env } };
  vm.runInNewContext(code, context);
  return context.exports.default;
}
test('release config fails closed for missing or invalid OTA channel', () => {
  const env = { EXPO_PUBLIC_APP_VARIANT: 'production', EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_example' };
  for (const channel of [undefined, 'preview', 'typo']) {
    assert.throws(() => config({ ...env, ACHARYA_UPDATE_CHANNEL: channel }), /channel|CHANNEL/);
  }
  for (const channel of ['staging', 'production']) {
    const c = config({ ...env, ACHARYA_UPDATE_CHANNEL: channel });
    assert.equal(c.updates.requestHeaders['expo-channel-name'], channel);
    assert.equal(c.runtimeVersion.policy, 'appVersion');
    assert.equal(c.updates.fallbackToCacheTimeout, 0);
    assert.equal(c.updates.checkAutomatically, 'ON_LOAD');
    assert.equal(c.updates.useEmbeddedUpdate, true);
    assert.equal(c.updates.disableAntiBrickingMeasures, undefined);
    assert.equal(c.version, require('../package.json').version);
  }
});
test('staging uses production environment but a separate delivery channel', () => {
  const { build } = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  assert.equal(build.staging.extends, 'production');
  assert.equal(build.staging.environment, 'production');
  assert.equal(build.staging.channel, 'staging');
  assert.equal(build.production.channel, 'production');
  assert.equal(config({}).updates.requestHeaders['expo-channel-name'], 'preview');
});
test('release export excludes inherited backend settings and secrets', () => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('scripts/release-environment.cjs', 'utf8'), {
    module,
    process: { env: { EXPO_PUBLIC_API_URL: 'https://old.invalid', CLERK_SECRET_KEY: 'private', EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED: 'true' } },
    require: (name) => name === 'node:fs' ? { readFileSync: () => 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_example' } : require(name),
  });
  const env = module.exports('staging');
  assert.equal(env.EXPO_PUBLIC_API_URL, undefined);
  assert.equal(env.CLERK_SECRET_KEY, undefined);
  assert.equal(env.EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED, 'true');
  assert.equal(env.EXPO_PUBLIC_APP_VARIANT, 'production');
  assert.equal(env.ACHARYA_UPDATE_CHANNEL, 'staging');
  assert.equal(env.EXPO_NO_DOTENV, '1');
});
