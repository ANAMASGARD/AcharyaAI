const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const queryParserPath = path.join(path.dirname(require.resolve('expo-router/package.json')), 'build/fork/getStateFromPath-forks.js');
const { parseQueryParams } = require(queryParserPath);
const parse = (query) => parseQueryParams('/?' + query, { name: 'test' });

test('Router query strings preserve Unicode, spaces, repeated keys, and empty values', () => {
  assert.deepEqual(
    { ...parse('name=%E0%A4%97%E0%A5%81%E0%A4%B0%E0%A5%81+ji&tag=one&tag=two&empty=&flag') },
    { name: 'गुरु ji', tag: ['one', 'two'], empty: '', flag: '' }
  );
  assert.equal(parse(new URLSearchParams({ name: 'गुरु + ji' }).toString()).name, 'गुरु + ji');
});

test('Router query strings recover valid characters beside malformed UTF-8', () => {
  assert.equal(parse('value=%FF%41%E0%A4%97').value, '�Aग');
});

test('Router handles a long malformed query without excessive CPU use', () => {
  // A subprocess deadline keeps the vulnerable decoder from hanging the test runner.
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { parseQueryParams } = require(${JSON.stringify(queryParserPath)});
    const parse = (query) => parseQueryParams('/?' + query, { name: 'test' });
    const value = '%FF'.repeat(5000);
    assert.equal(parse('value=' + value).value, '�'.repeat(5000));
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
