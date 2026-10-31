const { Buffer } = require('node:buffer');
// RN 0.88 no longer installs the external abort-controller package. Keep the
// limited-signal regression without relying on an undeclared transitive dependency.
class MobileAbortController extends AbortController {
  constructor() {
    super();
    Object.defineProperty(this.signal, 'throwIfAborted', { value: undefined });
  }
}
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const { drizzle } = require('../node_modules/drizzle-orm/expo-sqlite/driver.cjs');
function load(file, mocks, extra={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports, require:name=>name in mocks?mocks[name]:require(name), AbortController, URL, Uint8Array, DataView, setTimeout, clearTimeout, ...extra});
  return exports;
}
function setup(enabled=true, ack=true) {
  const sqlite=new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of fs.readdirSync('drizzle/expo').filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(fs.readFileSync(`drizzle/expo/${file}`,'utf8'));
  const schema=load('src/db/schema.ts',{});
  const db=drizzle({prepareSync(sql){return {
    executeSync(params){const stmt=sqlite.prepare(sql);return {...stmt.run(...params),getAllSync:()=>stmt.all(...params),getFirstSync:()=>stmt.get(...params)};},
    executeForRawResultSync(params){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return {getAllSync:()=>stmt.all(...params)};}
  };}},{schema});
  const contract=load('src/lib/embeddings/contract.ts',{});
  const sync=load('src/lib/embeddings/sync-contract.ts',{'./contract':contract});
  const calls=[]; let customFetch;
  const cloud=load('src/lib/reports/cloud.ts',{'@/db/ready':{readyLocalDb:async()=>db},'@/db/schema':schema,
    '@/lib/embeddings/indexing':{scheduleReportIndexing:async()=>{},addReportIndexSources:()=>{}},
    '@/lib/embeddings/sync-contract':sync,'./sync-contract':load('src/lib/reports/sync-contract.ts',{})},
    {AbortController: MobileAbortController, process:{env:{EXPO_PUBLIC_NEON_FUNCTION_URL:'https://api.example.test'}},fetch:async(url,options)=>{
      calls.push({url,...options});
      if (customFetch) return customFetch(url,options);
      const body=options.body?JSON.parse(options.body):null;
      return {ok:true,json:async()=>body?{ids:ack?body.chunks.map(c=>c.id):['wrong']}:{items:[],cursor:'0',hasMore:false}};
    }});
  const owner='alice',id='a'.repeat(21),now=new Date().toISOString();
  db.insert(schema.recordingSessions).values({id,ownerClerkId:owner,title:'Plants',subject:'Science',grade:'6',startedAt:now,updatedAt:now,durationMs:30000,expectedChunkCount:1,status:'complete',serverCreated:true,serverFinalized:true}).run();
  db.insert(schema.localReports).values({sessionId:id,ownerClerkId:owner,title:'Plants',subject:'Science',grade:'6',recordedAt:now,durationMs:30000,reportJson:'{}',classNotes:'Plants use sunlight.',model:'test',createdAt:now}).run();
  db.insert(schema.reportSyncAcks).values({id,owner,revision:'1'}).run();
  db.insert(schema.reportSyncAccounts).values({owner,enabled}).run();
  const vector=Buffer.alloc(1024);vector.writeFloatLE(1,0);
  db.insert(schema.reportVectors).values({id:'b'.repeat(21),sessionId:id,owner,kind:'notes',chunkIndex:0,title:'Plants',content:'Plants use sunlight.',contract:contract.EMBEDDING_CONTRACT,vector}).run();
  return {sqlite,db,schema,cloud,calls,respond:fn=>{customFetch=fn;},pending:()=>sqlite.prepare('SELECT synced FROM report_vectors').get().synced};
}
test('vectors remain local when sync is disabled',async()=>{
  const h=setup(false);try{await h.cloud.syncReports('alice',async()=>'token');assert.equal(h.calls.length,0);assert.equal(h.pending(),0);}finally{h.sqlite.close();}
});
test('normalized local vectors use authenticated upload and ack only their account rows',async()=>{
  const h=setup();try{
    await h.cloud.syncReports('bob',async()=>'other-token');assert.ok(h.calls.every(call => call.method === 'GET'));h.calls.length=0;
    await h.cloud.syncReports('alice',async()=>'token');
    assert.equal(h.pending(),1);
    const request=h.calls.find(c=>c.url.endsWith('/vectors'));assert.ok(request);assert.equal(request.headers.Authorization,'Bearer token');
    const body=JSON.parse(request.body);assert.equal(body.chunks[0].vector.length,256);assert.equal('owner' in body,false);assert.equal('transcript' in body,false);
  }finally{h.sqlite.close();}
});
test('invalid cloud acknowledgement leaves durable vectors queued for retry',async()=>{
  const h=setup(true,false);try{await h.cloud.syncReports('alice',async()=>'token');assert.equal(h.pending(),0);
    assert.match(h.sqlite.prepare('SELECT last_error FROM report_sync_accounts').get().last_error,/acknowledgement/);
  }finally{h.sqlite.close();}
});


test('new accounts default to sync On while explicit Off remains saved',async()=>{
  const h=setup(false);try{
    assert.equal((await h.cloud.reportSyncStatus('alice')).enabled,false);
    assert.equal((await h.cloud.reportSyncStatus('new-account')).enabled,true);
    await h.cloud.setReportSyncConsent('new-account',false);
    assert.equal((await h.cloud.reportSyncStatus('new-account')).enabled,false);
  }finally{h.sqlite.close();}
});


const goodReply = options => ({ok:true,status:200,json:async()=>options.body?{ids:JSON.parse(options.body).chunks.map(row=>row.id)}:{items:[],cursor:'0',hasMore:false}});
test('429 retries preserve the same FIFO batch and clear the error after acknowledgement',async()=>{
  const h=setup();let attempts=0;h.respond(async(url,options)=>url.endsWith('/vectors') && attempts++===0
    ? {ok:false,status:429,headers:{get:()=>null}} : goodReply(options));
  try{await h.cloud.syncReports('alice',async()=>'token');assert.equal(h.pending(),1);
    const uploads=h.calls.filter(call=>call.url.endsWith('/vectors'));assert.equal(uploads.length,2);assert.equal(uploads[0].body,uploads[1].body);
    assert.equal(h.sqlite.prepare('SELECT last_error FROM report_sync_accounts').get().last_error,null);
  }finally{h.sqlite.close();}
});
test('offline failure keeps the head and all later vectors queued; reconnect drains persisted FIFO',async()=>{
  const h=setup();
  h.sqlite.exec("UPDATE report_vectors SET enqueue_sequence=10; INSERT INTO report_vectors SELECT 'ccccccccccccccccccccc',session_id,owner,'reflection',1,title,content,contract,vector,0,30 FROM report_vectors; INSERT INTO report_vectors SELECT 'ddddddddddddddddddddd',session_id,owner,'reflection',2,title,content,contract,vector,0,20 FROM report_vectors WHERE id='bbbbbbbbbbbbbbbbbbbbb';");
  h.respond(async()=>{throw new Error('Network unavailable');});
  try{
    await h.cloud.syncReports('alice',async()=>'token');assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM report_vectors WHERE synced=0').get().n,3);
    h.calls.length=0;h.respond(async(url,options)=>goodReply(options));await h.cloud.syncReports('alice',async()=>'token');
    const upload=h.calls.find(call=>call.url.endsWith('/vectors'));assert.deepEqual(JSON.parse(upload.body).chunks.map(row=>row.id),['b'.repeat(21),'d'.repeat(21),'c'.repeat(21)]);
    assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM report_vectors WHERE synced=0').get().n,0);
    h.calls.length=0;await h.cloud.syncReports('alice',async()=>'token');assert.equal(h.calls.filter(call=>call.method==='POST').length,0);
  }finally{h.sqlite.close();}
});
test('an unfinished oldest vector blocks later ready vectors rather than reordering the queue',async()=>{
  const h=setup();
  h.sqlite.exec("UPDATE report_vectors SET enqueue_sequence=10; INSERT INTO report_vectors SELECT 'ccccccccccccccccccccc',session_id,owner,'reflection',1,title,content,contract,vector,0,20 FROM report_vectors; UPDATE report_vectors SET vector=NULL WHERE id='bbbbbbbbbbbbbbbbbbbbb';");
  try{await h.cloud.syncReports('alice',async()=>'token');assert.equal(h.calls.filter(call=>call.method==='POST').length,0);
    assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM report_vectors WHERE synced=0').get().n,2);
  }finally{h.sqlite.close();}
});

test('cancellation while an upload is in flight cannot acknowledge or remove queued vectors',async()=>{
  const h=setup();let release;let started;
  const active=new Promise(resolve=>{started=resolve;});
  h.respond(async(url,options)=>{if(url.endsWith('/vectors')){started();return new Promise(resolve=>{release=()=>resolve(goodReply(options));});}return goodReply(options);});
  try{
    const syncing=h.cloud.syncReports('alice',async()=>'token');await active;h.cloud.stopReportSync('alice');release();await syncing;
    assert.equal(h.pending(),0);assert.equal(h.sqlite.prepare('SELECT last_error FROM report_sync_accounts').get().last_error,null);
  }finally{h.sqlite.close();}
});
