/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const RealImageKit = require('@imagekit/nodejs').default;

function load(file, overrides = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => overrides[name] ?? require(name), module, module.exports);
  return module.exports;
}
const validation = load('src/server/community/media-validation.ts');
const id = 'I'.repeat(21), groupId = 'G'.repeat(21), hash = 'a'.repeat(64);
const filePath = `/acharya/community/${id}.png`;
const png = new Uint8Array(24);
png.set([137,80,78,71,13,10,26,10]); png.set([73,72,68,82],12);
const good = { fileId:'file_123',filePath,isPrivateFile:true,fileType:'image',mime:'image/png',width:400,height:300,size:24,tags:[`acharya-sha256-${hash}`] };

function providerWith(options = {}) {
  const calls = [], helper = new RealImageKit({ privateKey:'test-private-key' }).helper;
  class SDK {
    constructor(config) {
      calls.push(['config',config]);
      this.helper = helper;
      this.assets = { list: async query => { calls.push(['list',query]); return options.list ? options.list(query) : []; } };
      this.files = {
        upload: async data => { calls.push(['upload',data]); if(options.uploadError) throw options.uploadError; return {fileId:'file_123'}; },
        get: async value => { calls.push(['get',value]); return options.image ?? good; },
        delete: async value => { calls.push(['delete',value]); if(options.deleteError) throw options.deleteError; },
      };
      this.cache = { invalidation: { create: async value => { calls.push(['purge',value]); if(options.purgeError) throw options.purgeError; return {requestId:'purge-id'}; } } };
    }
  }
  const module = load('src/server/community/imagekit.ts',{'./media-validation':validation,'@imagekit/nodejs':{__esModule:true,default:SDK,toFile:async(bytes,name,opts)=>({bytes,name,...opts})}});
  const previous = [process.env.IMAGEKIT_PRIVATE_KEY,process.env.IMAGEKIT_URL_ENDPOINT];
  process.env.IMAGEKIT_PRIVATE_KEY = 'test-private-key'; process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/test';
  let provider;
  try { provider = module.createImageKitProvider(); }
  finally { for(const [index,key] of ['IMAGEKIT_PRIVATE_KEY','IMAGEKIT_URL_ENDPOINT'].entries()) { if(previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; } }
  return { provider, calls, module };
}

test('photo bytes and declared MIME must agree; unsupported and oversized files are rejected', () => {
  assert.equal(validation.validateImageBytes(png,'image/png'),'png');
  assert.equal(validation.validateImageBytes(Uint8Array.from([255,216,255,224]),'image/jpeg'),'jpeg');
  for(const [bytes,mime] of [[png,'image/jpeg'],[new TextEncoder().encode('<svg>hello</svg>'),'image/svg+xml'],[new Uint8Array(0),'image/png'],[new Uint8Array(validation.MAX_IMAGE_BYTES+1),'image/png']]) assert.throws(()=>validation.validateImageBytes(bytes,mime));
  assert.throws(()=>validation.mediaId('../'+id));
  assert.equal(validation.imageWidth(null),900);
  for(const width of ['100','0','900x']) assert.throws(()=>validation.imageWidth(width));
});

test('raw request reader bounds chunked bytes and request duration', async () => {
  const stream = new ReadableStream({start(controller){ controller.enqueue(new Uint8Array(validation.MAX_IMAGE_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close(); }});
  await assert.rejects(validation.readImageBody(new Request('http://local',{method:'POST',body:stream,duplex:'half'})), error=>error.code==='IMAGE_TOO_LARGE');
  await assert.rejects(validation.readImageBody(new Request('http://local',{method:'POST',body:new ReadableStream(),duplex:'half'}),1),error=>error.code==='UPLOAD_TIMEOUT');
});

test('ImageKit upload is private, immutable, bounded and verifies persisted provider metadata', async () => {
  const {provider,calls}=providerWith();
  assert.deepEqual(await provider.upload(png,id,'png',hash),{fileId:'file_123',filePath,width:400,height:300,format:'png',sizeBytes:24});
  const config=calls.find(call=>call[0]==='config')[1], upload=calls.find(call=>call[0]==='upload')[1];
  assert.equal(config.timeout,25000); assert.equal(config.maxRetries,0);
  assert.equal(upload.isPrivateFile,true); assert.equal(upload.overwriteFile,false); assert.equal(upload.useUniqueFileName,false);
  assert.equal(upload.folder,'/acharya/community'); assert.equal(upload.fileName,`${id}.png`);
  assert.ok(calls.some(call=>call[0]==='get'));
});

test('malformed, public, foreign, nonimage and mismatched provider metadata are rejected', async () => {
  for(const change of [{isPrivateFile:false},{filePath:'/other.png'},{fileType:'non-image'},{size:1},{width:0},{tags:[]},{mime:'image/svg+xml'},{fileId:undefined}]) {
    const {provider}=providerWith({image:{...good,...change}});
    await assert.rejects(provider.upload(png,id,'png',hash),error=>error.code==='MEDIA_RESPONSE');
  }
});

test('retry recovers deterministic uploaded files without another upload or version', async () => {
  const {provider,calls}=providerWith({list:()=>[good]});
  await provider.upload(png,id,'png',hash);
  assert.ok(!calls.some(call=>call[0]==='upload'));
  let lists=0;
  const lost=providerWith({list:()=>++lists===1 ? [] : [good],uploadError:new Error('response lost')});
  await lost.provider.upload(png,id,'png',hash);
  assert.equal(lost.calls.filter(call=>call[0]==='upload').length,1);
});

test('capacity and network failures return redacted retryable errors', async () => {
  for(const [error,code] of [[{status:429,message:'secret'},'MEDIA_LIMIT'],[{status:402},'MEDIA_LIMIT'],[new Error('secret URL'),'MEDIA_UNAVAILABLE']]) {
    const {provider}=providerWith({uploadError:error});
    await assert.rejects(provider.upload(png,id,'png',hash),err=>err.code===code && err.retryable && !err.message.includes('secret'));
  }
});

test('signed delivery has five-minute expiration and constrained transformations', () => {
  const {provider}=providerWith();
  const before=Math.floor(Date.now()/1000), signed=provider.sign(filePath,360), url=new URL(signed.url);
  assert.ok(url.searchParams.get('ik-s')); assert.ok(Number(url.searchParams.get('ik-t'))>=before+300);
  assert.equal(new Date(signed.expiresAt).getTime(),Number(url.searchParams.get('ik-t'))*1000);
  assert.match(url.searchParams.get('tr'),/w-360/);
  assert.throws(()=>provider.sign('https://other.test/a.png',360));
});

test('delete resolves an unregistered file, treats missing objects idempotently and queues cache purge', async () => {
  const {provider,calls}=providerWith({list:()=>[good],deleteError:{status:404}});
  await provider.remove(null,filePath);
  assert.equal(calls.filter(call=>call[0]==='delete').length,1); assert.equal(calls.filter(call=>call[0]==='purge').length,4);
  const failed=providerWith({list:()=>[good],purgeError:{status:429}});
  await assert.rejects(failed.provider.remove('file_123',filePath),error=>error.code==='MEDIA_LIMIT');
});

const lifecycle = load('src/server/community/media.ts',{'./media-validation':validation,'./db':{communityOperation:()=>{throw new Error('provide test operation')}},'./imagekit':{createImageKitProvider:()=>{throw new Error('provide test provider')}}});
function request() { return new Request('http://local/community/uploads',{method:'POST',headers:{'Content-Type':'image/png','X-Community-Image-Id':id,'X-Community-Group-Id':groupId},body:png}); }
test('upload reserves cleanup intent before provider and registers only through account/group recheck', async () => {
  const calls=[];
  const services={operation:async(owner,action,payload)=>{calls.push([owner,action,payload]);return {image:{status:'pending',filePath}};},provider:{upload:async()=>{calls.push(['provider']);return {filePath,fileId:'file_123'};}}};
  await lifecycle.uploadCommunityImage(request(),'teacher-a',services);
  assert.equal(calls[0][1],'media_prepare'); assert.equal(calls[1][0],'provider'); assert.equal(calls[2][1],'media_register');
  assert.match(calls[0][2].contentHash,/^[a-f0-9]{64}$/); assert.equal(calls[0][2].groupId,groupId);
});
test('forbidden reservations never call provider; a failed register leaves retry and cleanup intent intact', async () => {
  let uploads=0;
  const provider={upload:async()=>{uploads++;return good;}};
  await assert.rejects(lifecycle.uploadCommunityImage(request(),'teacher-b',{provider,operation:async()=>{throw new Error('forbidden');}}));
  assert.equal(uploads,0);
  await assert.rejects(lifecycle.uploadCommunityImage(request(),'teacher-a',{provider,operation:async(_,action)=>{if(action==='media_register')throw new Error('removed membership');return {image:{status:'pending'}};}}));
  assert.equal(uploads,1);
});
test('signing calls authorization before returning any delivery URL',async()=>{
  let signs=0;
  const provider={sign:()=>{signs++;return {url:'signed',expiresAt:'later'};}};
  await assert.rejects(lifecycle.signCommunityImage('nonmember',id,'900',{provider,operation:async()=>{throw new Error('forbidden');}}));
  assert.equal(signs,0);
  await lifecycle.signCommunityImage('member',id,'900',{provider,operation:async()=>({image:{filePath,fileId:'file_123',status:'attached'}})});
  assert.equal(signs,1);
});
test('cleanup passes lease fences and persists redacted failures for retry', async()=>{
  const actions=[];
  const services={provider:{remove:async()=>{throw new Error('secret');}},operation:async(_,action,payload)=>{actions.push([action,payload]);return {jobs:[{jobId:'job',leaseToken:'lease',filePath,fileId:null}]};}};
  assert.deepEqual(await lifecycle.cleanupCommunityMedia('teacher-a',5,services),{completed:0,failed:1});
  assert.deepEqual(actions[1],['media_cleanup_fail',{jobId:'job',leaseToken:'lease',error:'MEDIA_DELETE_FAILED'}]);
});

test('provider upload followed by failed DB registration remains recoverable by path cleanup', async()=>{
  const contentHash=createHash('sha256').update(png).digest('hex');
  const image={...good,tags:[`acharya-sha256-${contentHash}`]};
  let uploaded=false, completed=false;
  const {provider,calls}=providerWith({image,list:()=>uploaded?[image]:[]});
  const operation=async(_,action)=>{
    if(action==='media_prepare')return {image:{status:'pending',filePath}};
    if(action==='media_register'){uploaded=true;throw new Error('database connection lost');}
    if(action==='media_cleanup_claim')return {jobs:[{jobId:id,leaseToken:'lease',filePath,fileId:null}]};
    if(action==='media_cleanup_complete'){completed=true;return {updated:true};}
    throw new Error('unexpected operation');
  };
  await assert.rejects(lifecycle.uploadCommunityImage(request(),'teacher-a',{provider,operation}));
  assert.equal(calls.filter(call=>call[0]==='upload').length,1);
  assert.deepEqual(await lifecycle.cleanupCommunityMedia('teacher-a',1,{provider,operation}),{completed:1,failed:0});
  assert.ok(completed); assert.equal(calls.filter(call=>call[0]==='delete').length,1);
});

test('reservation with no uploaded provider object can be cleaned without deleting a foreign file',async()=>{
  const {provider,calls}=providerWith();
  const services={provider,operation:async(_,action)=>action==='media_cleanup_claim'?{jobs:[{jobId:id,leaseToken:'lease',filePath,fileId:null}]}:{updated:true}};
  assert.deepEqual(await lifecycle.cleanupCommunityMedia('teacher-a',1,services),{completed:1,failed:0});
  assert.equal(calls.filter(call=>call[0]==='delete').length,0);
});

test('cleanup runs at most two jobs concurrently and settles every claimed success and failure',async()=>{
  let active=0, peak=0;
  const jobs=Array.from({length:5},(_,index)=>({jobId:`job${index}`,leaseToken:`lease${index}`,filePath:`/photo${index}`,fileId:`file${index}`}));
  const settled=[];
  const provider={remove:async(_,path)=>{
    active++;peak=Math.max(peak,active);
    await new Promise(resolve=>setTimeout(resolve,2));
    active--;
    if(path==='/photo1'||path==='/photo3')throw new Error('provider secret');
  }};
  const operation=async(_,action,payload)=>{
    if(action==='media_cleanup_claim')return {jobs};
    settled.push([action,payload]);return {updated:true};
  };
  assert.deepEqual(await lifecycle.cleanupCommunityMedia('teacher-a',5,{provider,operation}),{completed:3,failed:2});
  assert.equal(peak,2);assert.equal(active,0);assert.equal(settled.length,5);
  assert.equal(settled.filter(([action])=>action==='media_cleanup_complete').length,3);
  assert.equal(settled.filter(([action])=>action==='media_cleanup_fail').length,2);
  for(const [,payload]of settled){assert.equal(payload.leaseToken,`lease${payload.jobId.at(-1)}`);assert.ok(!JSON.stringify(payload).includes('provider secret'));}
});

test('cleanup surfaces acknowledgement failures after settling other claimed jobs',async()=>{
  const jobs=Array.from({length:5},(_,index)=>({jobId:`job${index}`,leaseToken:`lease${index}`,filePath:`/photo${index}`,fileId:null}));
  const removed=[], completed=[];
  const provider={remove:async(_,path)=>{removed.push(path);}};
  const operation=async(_,action,payload)=>{
    if(action==='media_cleanup_claim')return {jobs};
    if(payload.jobId==='job0')throw new Error('stale lease acknowledgement');
    completed.push(payload.jobId);return {updated:true};
  };
  await assert.rejects(lifecycle.cleanupCommunityMedia('teacher-a',5,{provider,operation}),/stale lease acknowledgement/);
  assert.equal(removed.length,5);assert.deepEqual(completed.sort(),['job1','job2','job3','job4']);
});

test('provider failures notify durable cleanup without invalidating an active teacher draft',async()=>{
  const actions=[];
  const operation=async(_,action,payload)=>{actions.push([action,payload]);return {image:{status:'pending'}};};
  const provider={upload:async()=>{throw new validation.CommunityMediaError('MEDIA_LIMIT','Try later',503,true);}};
  await assert.rejects(lifecycle.uploadCommunityImage(request(),'teacher-a',{operation,provider}),error=>error.code==='MEDIA_LIMIT');
  assert.deepEqual(actions.map(([action])=>action),['media_prepare','media_upload_failed']);
  assert.deepEqual(actions[1][1],{imageId:id});
});

test('failed cleanup notification returns a retryable finalization failure',async()=>{
  const operation=async(_,action)=>{if(action==='media_upload_failed')throw new Error('database unavailable');return {image:{status:'pending'}};};
  const provider={upload:async()=>{throw new Error('provider unavailable');}};
  await assert.rejects(lifecycle.uploadCommunityImage(request(),'teacher-a',{operation,provider}),error=>error.code==='IMAGE_FINALIZATION_RETRY'&&error.retryable);
});
