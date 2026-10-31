const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const test = require('node:test');

const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const queryStringPath = routerRequire.resolve('query-string');
const queryString = routerRequire('query-string');

test('Router query strings preserve Unicode, spaces, repeated keys, and empty values', () => {
  assert.deepEqual(
    { ...queryString.parse('name=%E0%A4%97%E0%A5%81%E0%A4%B0%E0%A5%81+ji&tag=one&tag=two&empty=&flag') },
    { name: 'गुरु ji', tag: ['one', 'two'], empty: '', flag: null }
  );
  assert.equal(queryString.parse(queryString.stringify({ name: 'गुरु + ji' })).name, 'गुरु + ji');
});

test('Router query strings recover valid characters beside malformed UTF-8', () => {
  assert.equal(queryString.parse('value=%FF%41%E0%A4%97').value, '%FFAग');
});

test('Router handles a long malformed query without excessive CPU use', () => {
  // A subprocess deadline keeps the vulnerable decoder from hanging the test runner.
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const queryString = require(${JSON.stringify(queryStringPath)});
    const value = '%FF'.repeat(5000);
    assert.equal(queryString.parse('value=' + value).value, value);
  `], { timeout: 3000, stdio: 'pipe' });
});

test('Xcode tooling generates unique project identifiers with the patched UUID', () => {
  const xcode = require('xcode');
  const project = xcode.project('test.pbxproj');
  project.hash = { project: { objects: {} } };
  const identifiers = Array.from({ length: 100 }, () => project.generateUuid());
  assert.equal(new Set(identifiers).size, identifiers.length);
  for (const identifier of identifiers) {
    assert.match(identifier, /^[A-F0-9]{24}$/);
  }
});
