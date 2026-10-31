const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = process.cwd();

test('Clerk config validates publishable key prefixes', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/clerk-config.ts'), 'utf8');
  assert.match(src, /pk_test_/);
  assert.match(src, /pk_live_/);
  assert.match(src, /assertClerkKeyAllowedForRelease/);
});

test('EAS production profile uses Play app-bundle', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
});
