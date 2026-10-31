const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, env = {}, claims = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Response, process: { env }, require: () => ({ verifyToken: async () => claims }) });
  return exports;
}
const env = { CLERK_SECRET_KEY:'sk_live_fake', CLERK_ISSUER:'https://clerk.superacharya.com', CLERK_AUTHORIZED_PARTIES:'https://superacharya.com', APP_ENV:'production' };
const valid = { sub:'user_alice', sid:'sess_native', iss:env.CLERK_ISSUER };
const request = () => new Request('https://example.com', { headers:{ Authorization:'Bearer test' } });
test('production auth rejects missing config, wrong issuer, non-session credentials and unexpected azp', async () => {
  for (const claims of [{...valid,iss:'https://test.clerk.accounts.dev'}, {...valid,sid:undefined}, {...valid,sub:'m2m_app'}, {...valid,azp:'https://evil.example'}]) {
    const result=await load('src/server/db/auth.ts',env,claims).requireClerkUserId(request());
    assert.equal(result.ok,false);assert.equal(result.response.status,401);
  }
  const result=await load('src/server/db/auth.ts',{...env,CLERK_SECRET_KEY:'sk_test_fake'},valid).requireClerkUserId(request());
  assert.equal(result.ok,false);assert.equal(result.response.status,500);
});
test('native sessions without azp work; missing bearer token fails', async () => {
  const auth=load('src/server/db/auth.ts',env,valid);
  assert.equal((await auth.requireClerkUserId(request())).clerkUserId,'user_alice');
  assert.equal((await auth.requireClerkUserId(new Request('https://example.com'))).response.status,401);
});
const report={ id:'a'.repeat(21), title:'Plants', subject:'Science', grade:'6', recordedAt:'2026-10-13T00:00:00Z', durationMs:65000,
  reportJson:JSON.stringify({overallScore:70,classroomEnvironment:'Calm',whatWentWrong:'None',areasToImprove:'Examples',topicSpecificFeedback:'Plants'}),classNotes:'Plants use sunlight.',model:'test',createdAt:'2026-10-13T01:00:00Z'};
test('sync contract rejects raw transcripts, owner injection, keys, invalid metadata and reflections', () => {
  const {validateSyncedReport}=load('src/lib/reports/sync-contract.ts');
  assert.equal(validateSyncedReport(report).id, report.id);
  for (const extra of [{ transcript:'private speech' },{ owner:'user_other' },{ apiKey:'secret' },{ durationMs:-1 },{ id:'short' },{ recordedAt:'no' },{ reportJson:'{}' }]) {
    assert.throws(()=>validateSyncedReport({...report,...extra}));
  }
  const reverse={...report, reportJson:JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(report.reportJson)).reverse()))};
  assert.equal(JSON.stringify(validateSyncedReport(report)), JSON.stringify(validateSyncedReport(reverse)));
});
