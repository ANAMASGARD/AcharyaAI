const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { Buffer } = require('node:buffer');
const ts = require('typescript');
function config(env) {
  const code = ts.transpileModule(fs.readFileSync('app.config.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, URL, process: { env } };
  vm.runInNewContext(code, context);
  return context.exports.default;
}
test('release config fails closed for missing or invalid OTA channel', () => {
  const env = { EXPO_PUBLIC_APP_VARIANT: 'production', EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_example', EXPO_PUBLIC_NEON_FUNCTION_URL: 'https://api.example.com' };
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
test('EAS builds reject absent, insecure or credential-bearing community endpoints', () => {
  for (const profile of ['development', 'preview']) {
    for (const url of [undefined, '', 'http://localhost:8081', 'https://user:secret@example.com', 'https://example.com?key=secret', 'https://example.com#fragment']) {
      assert.throws(() => config({ EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_NEON_FUNCTION_URL: url }), /EXPO_PUBLIC_NEON_FUNCTION_URL/);
    }
    assert.doesNotThrow(() => config({ EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_NEON_FUNCTION_URL: 'https://api.example.com' }));
  }
});
test('EAS profiles resolve matching public auth and community settings before remote environment loading', () => {
  const { build } = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  for (const profile of ['development', 'preview', 'production']) {
    const env = { ...build[profile].env, EAS_BUILD_PROFILE: profile };
    assert.doesNotThrow(() => config(env));
    assert.match(env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, profile === 'production' ? /^pk_live_/ : /^pk_test_/);
    assert.equal(env.EXPO_PUBLIC_NEON_FUNCTION_URL, profile === 'production'
      ? 'https://br-icy-resonance-b3camzf0-acharya.compute.c-4.ap-southeast-1.aws.neon.tech'
      : 'https://br-steep-recipe-b3ujia3w-acharya.compute.c-4.ap-southeast-1.aws.neon.tech');
    assert.equal(Object.keys(env).some(key => /SECRET|PRIVATE|DATABASE/.test(key)), false);
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
    process: { env: { EXPO_PUBLIC_API_URL: 'https://old.invalid', CLERK_SECRET_KEY: 'private', IMAGEKIT_PRIVATE_KEY: 'private-media-key', COMMUNITY_CLEANUP_SECRET: 'private-cleanup-key', ACHARYA_IMAGEKIT_PRIVATE_KEY: 'private-release-key', EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED: 'true' } },
    require: (name) => name === 'node:fs' ? { readFileSync: () => 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_example' } : require(name),
  });
  const env = module.exports('staging');
  assert.equal(env.EXPO_PUBLIC_API_URL, undefined);
  assert.equal(env.CLERK_SECRET_KEY, undefined);
  assert.equal(env.IMAGEKIT_PRIVATE_KEY, undefined);
  assert.equal(env.COMMUNITY_CLEANUP_SECRET, undefined);
  assert.equal(env.ACHARYA_IMAGEKIT_PRIVATE_KEY, undefined);
  assert.equal(env.EXPO_PUBLIC_MICROSOFT_AUTH_ENABLED, 'true');
  assert.equal(env.EXPO_PUBLIC_APP_VARIANT, 'production');
  assert.equal(env.ACHARYA_UPDATE_CHANNEL, 'staging');
  assert.equal(env.EXPO_NO_DOTENV, '1');
});
test('staging export clears cached transforms and rejects bundles missing the configured API or Clerk key', () => {
  const env = { EXPO_PUBLIC_NEON_FUNCTION_URL: 'https://api.example.com', EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_fixture' };
  function run(bundle) {
    const process = {};
    vm.runInNewContext(fs.readFileSync('scripts/export-ota-staging.cjs', 'utf8'), { process,
      require(name) {
        if (name === './release-environment.cjs') return () => env;
        if (name === 'node:child_process') return { spawnSync: (_cmd, args) => { assert(args.includes('--clear')); return { status: 0 }; } };
        if (name === 'node:fs') return { readFileSync: file => file.endsWith('metadata.json') ? JSON.stringify({ fileMetadata: { android: { bundle: 'entry.hbc' } } }) : Buffer.from(bundle) };
        return require(name);
      },
    });
    return process.exitCode;
  }
  assert.throws(() => run(env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY), /EXPO_PUBLIC_NEON_FUNCTION_URL/);
  assert.throws(() => run(env.EXPO_PUBLIC_NEON_FUNCTION_URL), /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  assert.equal(run(Object.values(env).join('\n')), 0);
});
