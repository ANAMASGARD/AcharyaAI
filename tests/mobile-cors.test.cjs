const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/http/mobile-cors.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject, Headers, Response, process: { env: { CLERK_AUTHORIZED_PARTIES: 'http://localhost:8081,https://superacharya.com' } } });
const { mobileCors } = exportsObject;
const request = (origin, method = 'GET', headers = {}) => new Request('https://api.example.com/community/posts', {
  method, headers: { ...(origin ? { Origin: origin } : {}), ...headers },
});

test('native clients need no Origin; browser responses allow only explicit configured origins', () => {
  assert.equal(mobileCors(request()).get('Access-Control-Allow-Origin'), null);
  assert.equal(mobileCors(request('http://localhost:8081')).get('Access-Control-Allow-Origin'), 'http://localhost:8081');
  assert.equal(mobileCors(request('https://superacharya.com')).get('Access-Control-Allow-Origin'), 'https://superacharya.com');
  for (const origin of ['https://evil.example', 'null', 'http://localhost:8081.evil.example']) {
    const response = mobileCors(request(origin));
    assert.equal(response.status, 403); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
});

test('browser preflight allows bearer and photo headers without bypassing request authentication', () => {
  const preflight = mobileCors(request('http://localhost:8081', 'OPTIONS', {
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization, Content-Type, X-Community-Image-Id, X-Community-File-Name, X-Community-Group-Id',
  }));
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /authorization/);
  assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), null);
  const actual = mobileCors(request('http://localhost:8081', 'POST'));
  assert(actual instanceof Headers); // The dispatcher still has to verify Clerk.
  for (const headers of [
    { 'Access-Control-Request-Method': 'PATCH' },
    { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'X-Admin-Token' },
  ]) assert.equal(mobileCors(request('http://localhost:8081', 'OPTIONS', headers)).status, 403);
});
