/* global __dirname */
const { Buffer } = require("node:buffer");
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
function load(file, overrides = {}) {
  const result = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => overrides[name] ?? require(name), result, result.exports);
  return result.exports;
}
const validation = load('src/server/recording/validation.ts');
function wav(seconds) {
  const b = new Uint8Array(44 + seconds * 32000), v = new DataView(b.buffer);
  for (const [offset, tag] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']]) for (let i=0;i<tag.length;i++) b[offset+i]=tag.charCodeAt(i);
  for (const [o,n] of [[4,b.length-8],[16,16],[24,16000],[28,32000],[40,b.length-44]]) v.setUint32(o,n,true);
  for (const [o,n] of [[20,1],[22,1],[32,2],[34,16]]) v.setUint16(o,n,true);
  return b;
}
test('strict WAV accepts thirty-second and final five-second segments', () => {
  validation.validateWav(wav(30),30000); validation.validateWav(wav(5),5000);
});
test('rejects oversized, empty, mismatched timing and noncanonical audio', () => {
  for (const [b,ms] of [[wav(31),31000],[wav(0),0],[wav(5),6000],[new Uint8Array(12),10]]) assert.throws(()=>validation.validateWav(b,ms));
  const b=wav(1); b[22]=2; assert.throws(()=>validation.validateWav(b,1000));
});
test('validates identifiers and metadata without coercion', () => {
  assert.equal(validation.id('a'.repeat(21)), 'a'.repeat(21));
  for (const x of ['short',null,21]) assert.throws(()=>validation.id(x));
  for (const x of [-1,NaN,'1',1.5]) assert.throws(()=>validation.integer(x,30));
  assert.throws(()=>validation.metadata(' '));
});
test('structured errors do not expose backend failures', async () => {
  const response=validation.errorResponse(new Error('secret connection URL'));
  assert.equal(response.status,503); assert.deepEqual(await response.json(), {error:{code:'SERVER_ERROR',message:'Recording service unavailable',retryable:true}});
});
test('Gnani adapter sends specified format and preserves intentional repeats', async () => {
  const previous=global.fetch, oldKey=process.env.GNANI_API_KEY; process.env.GNANI_API_KEY='test-key';
  global.fetch=async(url, options)=>{
    assert.equal(url,'https://api.vachana.ai/stt/v3'); assert.equal(options.headers['X-API-Key-ID'],'test-key');
    assert.equal(options.body.get('language_code'),'en-IN'); assert.equal(options.body.get('format'),'transcribe'); assert.ok(options.body.get('audio_file'));
    return Response.json({success:true,transcript:' repeat repeat '});
  };
  try { const provider=load('src/server/recording/provider.ts',{'@/server/recording/validation':validation}); assert.equal(await provider.transcribeWithGnani(new Blob([wav(1)])), 'repeat repeat'); }
  finally { global.fetch=previous; if(oldKey===undefined) delete process.env.GNANI_API_KEY; else process.env.GNANI_API_KEY=oldKey; }
});
const requestBody=load('src/server/recording/request-body.ts',{'@/server/recording/validation':validation});
const schema=load('src/server/db/schema/recordings.ts');
function request() {
  const form=new FormData();
  form.append('audio',new Blob([wav(1)],{type:'audio/wav'}),'chunk.wav');
  for(const [k,v] of Object.entries({sessionId:'s'.repeat(21),chunkId:'c'.repeat(21),chunkIndex:'0',startMs:'0',durationMs:'1000'})) form.append(k,v);
  return new Request('http://local/api/gnani/stt',{method:'POST',body:form});
}
function routeWith(results, provider, owner=async()=> 'owner') {
  const queries=[];
  const db={};
  for (const action of ['select','insert','update']) db[action]=()=>{
    const result=results.shift(); const query={action}; queries.push(query);
    const chain={then:(resolve,reject)=>Promise.resolve(result).then(resolve,reject)};
    for (const method of ['from','values','set','where','limit','onConflictDoNothing','onConflictDoUpdate','returning']) chain[method]=value=>{query[method]=value;return chain;};
    return chain;
  };
  return {queries, route:load('src/app/api/gnani/stt+api.ts',{'@/server/recording/request-body':requestBody,'@/server/db/client':{getServerDb:()=>db},'@/server/db/schema/recordings':schema,'@/server/recording/auth':{recordingOwner:owner},'@/server/recording/validation':validation,'@/server/recording/provider':{transcribeWithGnani:provider}})};
}
async function chunkRow() {
  const hash=Buffer.from(await crypto.subtle.digest('SHA-256',wav(1))).toString('hex');
  return {id:'c'.repeat(21),sessionId:'s'.repeat(21),chunkIndex:0,startMs:0,durationMs:1000,audioHash:hash,status:'processing'};
}
test('unauthorized requests and unknown ownership never call provider',async()=>{
  let calls=0;
  for(const owner of [async()=>{throw new validation.SttError('UNAUTHORIZED','Sign in',401)},async()=> 'different-owner']) {
    const {route}=routeWith([[]],async()=>{calls++;return 'text'},owner);
    const response=await route.POST(request()); assert.ok([401,404].includes(response.status));
  }
  assert.equal(calls,0);
});
test('completed duplicate returns saved transcript without a provider request',async()=>{
  const chunk={...await chunkRow(),status:'done',transcript:'hello hello'};
  const {route}=routeWith([[{id:chunk.sessionId}],[],[chunk]],async()=>{throw new Error('must not call')});
  const response=await route.POST(request()); assert.equal(response.status,200); assert.equal((await response.json()).transcript,'hello hello');
});
test('active claim rejects duplicate while expired claim can complete with fenced update',async()=>{
  const chunk=await chunkRow();let calls=0;
  const active=routeWith([[{id:chunk.sessionId}],[],[chunk],[{}],[]],async()=>{calls++;return 'text'});
  assert.equal((await active.route.POST(request())).status,409);assert.equal(calls,0);
  const expired=routeWith([[{id:chunk.sessionId}],[],[chunk],[{}],[chunk],[{id:chunk.sessionId}],[chunk]],async()=>{calls++;return 'text'});
  assert.equal((await expired.route.POST(request())).status,200);assert.equal(calls,1);
  const {PgDialect}=require('drizzle-orm/pg-core');const dialect=new PgDialect();
  const claim=expired.queries[4];const sql=dialect.sqlToQuery(claim.where);
  assert.match(sql.sql,/lease_until.*</);assert.match(sql.sql,/status.*in/);
  assert.equal(claim.set.leaseUntil.getTime()-claim.set.updatedAt.getTime(),120000);
  assert.match(dialect.sqlToQuery(expired.queries[6].where).sql,/claim_token/);
});
test('deletion while provider runs cannot recreate a transcript',async()=>{
  const chunk=await chunkRow();
  const {route}=routeWith([[{id:chunk.sessionId}],[],[chunk],[{}],[chunk],[{id:chunk.sessionId}],[],[]],async()=> 'text');
  const response=await route.POST(request());assert.equal(response.status,409);assert.equal((await response.json()).error.code,'CLAIM_EXPIRED');
});
test('conflicting audio identity and rate limits fail before transcription',async()=>{
  const chunk=await chunkRow();let calls=0;
  const conflict=routeWith([[{id:chunk.sessionId}],[],[{...chunk,audioHash:'different'}]],async()=>{calls++;return 'text'});
  assert.equal((await conflict.route.POST(request())).status,409);
  const limited=routeWith([[{id:chunk.sessionId}],[],[chunk],[]],async()=>{calls++;return 'text'});
  const response=await limited.route.POST(request());assert.equal(response.status,429);assert.equal((await response.json()).error.retryAfterMs,1000);assert.equal(calls,0);
});
test('provider failure releases only its fenced claim for retry',async()=>{
  const chunk=await chunkRow();
  const {route,queries}=routeWith([[{id:chunk.sessionId}],[],[chunk],[{}],[chunk],[{id:chunk.sessionId}],[]],async()=>{throw new validation.SttError('PROVIDER_UNAVAILABLE','timeout',503,true)});
  const response=await route.POST(request());assert.equal(response.status,503);assert.equal((await response.json()).error.retryable,true);
  const released=queries.at(-1);assert.equal(released.set.status,'failed');assert.equal(released.set.claimToken,null);assert.equal(released.set.leaseUntil,null);
});
test('HTTP 200 provider failures cannot become successful transcripts', async()=>{
  const previous=global.fetch,oldKey=process.env.GNANI_API_KEY;process.env.GNANI_API_KEY='test';
  try {
    const provider=load('src/server/recording/provider.ts',{'@/server/recording/validation':validation});
    for(const body of [{success:false,transcript:''},{success:false,transcript:'incorrect'},{transcript:'missing success'}]) {
      global.fetch=async()=>Response.json(body);
      await assert.rejects(()=>provider.transcribeWithGnani(new Blob([wav(1)])),{code:'PROVIDER_RESPONSE'});
    }
  } finally {global.fetch=previous;if(oldKey===undefined)delete process.env.GNANI_API_KEY;else process.env.GNANI_API_KEY=oldKey;}
});
test('request body limits apply to streaming bytes and stalled peers',async()=>{
  const large=new Request('http://local',{method:'POST',body:'a'.repeat(4097)});
  await assert.rejects(()=>requestBody.readRecordingBody(large,4096),{code:'TOO_LARGE'});
  const stalled={body:new ReadableStream({pull(){return new Promise(()=>{})},cancel(){return new Promise(()=>{})}})};
  await assert.rejects(()=>requestBody.readRecordingBody(stalled,4096,10),{code:'UPLOAD_TIMEOUT'});
});
test('finalized recordings reject segments outside their declared range',async()=>{
  let calls=0;
  const {route}=routeWith([[{id:'s'.repeat(21),status:'complete',expectedChunkCount:0,durationMs:0}]],async()=>{calls++;return 'text'});
  const response=await route.POST(request());assert.equal(response.status,409);assert.equal((await response.json()).error.code,'SESSION_FINALIZED');assert.equal(calls,0);
});
test('request cancellation interrupts stalled upload without waiting for deadline',async()=>{
  const controller=new AbortController();
  const stalled={signal:controller.signal,body:new ReadableStream({pull(){return new Promise(()=>{})}})};
  const pending=requestBody.readRecordingBody(stalled,4096);controller.abort();
  await assert.rejects(()=>pending,{code:'UPLOAD_CANCELED'});
});
function sessionRoute(results) {
  const queries=[];const db={};
  for(const action of ['select','update']) db[action]=()=>{
    const result=results.shift(),query={action};queries.push(query);
    const chain={then:(resolve,reject)=>Promise.resolve(result).then(resolve,reject)};
    for(const method of ['from','set','where','limit','orderBy','returning']) chain[method]=value=>{query[method]=value;return chain;};return chain;
  };
  return {queries,route:load('src/app/api/sessions+api.ts',{
    '@/server/recording/request-body':requestBody,'@/server/db/schema/recordings':schema,
    '@/server/recording/auth':{recordingOwner:async()=> 'owner'},'@/server/recording/validation':validation,
    '@/server/db/auth':{},'@/server/db/client':{getServerDb:()=>db},'@/server/db/schema/sessions':{},'@/server/sync/session-mapper':{},
  })};
}
const finalizeRequest=(overrides={})=>new Request('http://local/api/sessions',{method:'PATCH',body:JSON.stringify({id:'s'.repeat(21),durationMs:30001,expectedChunkCount:2,status:'complete',...overrides})});
test('partial finalization retries may complete, including one-sample final chunks',async()=>{
  const session={status:'partial',durationMs:30001,expectedChunkCount:2};
  const chunks=[{chunkIndex:0,durationMs:30000,status:'done'},{chunkIndex:1,durationMs:1,status:'empty'}];
  const {route,queries}=sessionRoute([[session],chunks,[{id:'s'.repeat(21)}]]);
  assert.equal((await route.PATCH(finalizeRequest())).status,200);
  const {PgDialect}=require('drizzle-orm/pg-core');const guard=new PgDialect().sqlToQuery(queries.at(-1).where);
  assert.match(guard.sql,/owner_clerk_id/);assert.match(guard.sql,/expected_chunk_count/);assert.match(guard.sql,/duration_ms/);
});
test('finalization cannot change closed timing or succeed after concurrent changes',async()=>{
  const changed=sessionRoute([[{status:'partial',durationMs:30000,expectedChunkCount:1}]]);
  assert.equal((await changed.route.PATCH(finalizeRequest())).status,409);
  const raced=sessionRoute([[{status:'recording',durationMs:0,expectedChunkCount:0}],[],[]]);
  const response=await raced.route.PATCH(finalizeRequest({status:'partial'}));
  assert.equal(response.status,409);assert.equal((await response.json()).error.code,'SESSION_CHANGED');
});
