const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFile, execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { promisify } = require('node:util');
const fs = require('node:fs');
const ts = require('typescript');
const run = promisify(execFile);
const database = process.env.COMMUNITY_TEST_DATABASE_URL;
const quote = value => "'"+value.replaceAll("'","''")+"'";
const id = () => randomBytes(16).toString('base64url').slice(0,21);

function loadMedia() {
  const load=(file,mocks={})=>{
    const module={exports:{}};
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',code)(name=>mocks[name]??require(name),module,module.exports);
    return module.exports;
  };
  const validation=load('src/server/community/media-validation.ts');
  return load('src/server/community/media.ts',{'./media-validation':validation,'./db':{communityOperation:()=>{throw new Error('inject database');}},'./imagekit':{createImageKitProvider:()=>{throw new Error('inject provider');}}});
}

function fixtures() {
  const owner='user_media'+randomBytes(6).toString('hex');
  const sql=text=>execFileSync('psql',[database,'-XAt','-v','ON_ERROR_STOP=1','-c',text],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const operationSql=(who,action,payload={},system=false)=>`SET LOCAL ROLE acharya_runtime; SELECT set_config('app.clerk_user_id',${quote(who)},true),set_config('app.community_cleanup',${quote(String(system))},true); SELECT acharya.community_operation(${quote(action)},${quote(JSON.stringify(payload))}::jsonb);`;
  const operation=(who,action,payload={},system=false)=>JSON.parse(sql(`BEGIN;${operationSql(who,action,payload,system)}COMMIT;`).split('\n').find(line=>line.startsWith('{')));
  const prepare=(imageId=id())=>{
    const payload={imageId,groupId:null,format:'jpeg',contentHash:'a'.repeat(64),sizeBytes:100};
    const image=operation(owner,'media_prepare',payload).image;
    operation(owner,'media_register',{imageId,fileId:'file_'+imageId,filePath:image.filePath,width:30,height:20,format:'jpeg',sizeBytes:100});
    return {imageId,payload};
  };
  return {owner,sql,operationSql,operation,prepare};
}

test('isolated PostgreSQL: retrying an old pending upload postpones orphan cleanup', {skip:!database},()=>{
  const {owner,sql,operation,prepare}=fixtures(), {imageId,payload}=prepare();
  sql(`UPDATE acharya.community_cleanup_jobs SET next_attempt_at=clock_timestamp()-interval '1 hour' WHERE id=${quote(imageId)};`);
  operation(owner,'media_prepare',payload);
  assert.equal(operation(owner,'media_upload_failed',{imageId}).queued,false);
  assert.equal(operation('user_other'+id(),'media_upload_failed',{imageId}).queued,false);
  assert.equal(operation(owner,'media_prepare',payload).image.status,'pending');
  assert.equal(sql(`SELECT next_attempt_at>clock_timestamp()+interval '23 hours' FROM acharya.community_cleanup_jobs WHERE id=${quote(imageId)};`).trim(),'t');
  assert(!operation('user_systemCleanup','media_cleanup_claim',{limit:10},true).jobs.some(job=>job.imageId===imageId));
});

test('isolated PostgreSQL: cleanup skips an image locked by in-flight publication', {skip:!database},async()=>{
  const {owner,sql,operationSql,operation,prepare}=fixtures(), {imageId}=prepare();
  sql(`UPDATE acharya.community_cleanup_jobs SET next_attempt_at=clock_timestamp()-interval '1 hour' WHERE id=${quote(imageId)};`);
  const post={postId:id(),title:'Photo',body:'Lesson',subjectTag:'Math',linkUrl:null,groupId:null,displayName:'Teacher',images:[{imageId}]};
  const marker='media_publish_'+id();
  const flight=run('psql',[database,'-XAt','-v','ON_ERROR_STOP=1','-c',`BEGIN;SET application_name=${quote(marker)};${operationSql(owner,'post_create',post)}SELECT pg_sleep(2);COMMIT;`]);
  let sleeping=false;
  for(let attempt=0;attempt<60;attempt++){
    sleeping=sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${quote(marker)} AND wait_event='PgSleep');`).trim()==='t';
    if(sleeping)break;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert(sleeping,'publisher must hold its image lock before cleanup runs');
  const jobs=operation('user_systemCleanup','media_cleanup_claim',{limit:10},true).jobs;
  assert(!jobs.some(job=>job.imageId===imageId));
  await flight;
  assert.equal(operation(owner,'media_access',{imageId}).image.status,'attached');
});

test('isolated PostgreSQL: trusted cleanup retains deletion work after owner tombstone', {skip:!database},()=>{
  const {owner,sql,operation,prepare}=fixtures(), {imageId}=prepare();
  sql(`UPDATE acharya.accounts SET deleted_at=clock_timestamp() WHERE owner=${quote(owner)};`);
  operation(owner,'account_delete');
  assert.equal(sql(`SELECT next_attempt_at>clock_timestamp()+interval '110 seconds' FROM acharya.community_cleanup_jobs WHERE id=${quote(imageId)};`).trim(),'t');
  sql(`UPDATE acharya.community_cleanup_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=${quote(imageId)};`);
  assert.throws(()=>operation(owner,'media_access',{imageId}),/ACCOUNT_DELETED/);
  const job=operation('user_systemCleanup','media_cleanup_claim',{limit:10},true).jobs.find(item=>item.imageId===imageId);
  assert(job);
  assert.throws(()=>operation('user_systemCleanup','media_cleanup_complete',{jobId:imageId,leaseToken:'wrong'},true),/CONFLICT/);
  operation('user_systemCleanup','media_cleanup_complete',{jobId:imageId,leaseToken:job.leaseToken},true);
  assert.equal(sql(`SELECT completed_at IS NOT NULL FROM acharya.community_cleanup_jobs WHERE id=${quote(imageId)};`).trim(),'t');
});

test('isolated PostgreSQL: account deletion plus early cleanup cannot orphan a late provider upload', {skip:!database},async()=>{
  const {owner,sql,operation}=fixtures(), imageId=id(), media=loadMedia();
  let allowUpload, uploadStarted, exists=false;
  const gate=new Promise(resolve=>{allowUpload=resolve;});
  const started=new Promise(resolve=>{uploadStarted=resolve;});
  const provider={
    upload:async()=>{
      uploadStarted();await gate;exists=true;
      return {fileId:'file_'+imageId,filePath:`/acharya/community/${imageId}.jpeg`,width:20,height:30,format:'jpeg',sizeBytes:4};
    },
    remove:async()=>{exists=false;},
  };
  const upload=media.uploadCommunityImage(new Request('http://local/community/uploads',{method:'POST',headers:{'content-type':'image/jpeg','X-Community-Image-Id':imageId},body:Uint8Array.from([255,216,255,224])}),owner,{provider,operation:async(who,action,payload)=>operation(who,action,payload)});
  await started;
  sql(`UPDATE acharya.accounts SET deleted_at=clock_timestamp() WHERE owner=${quote(owner)};`);
  operation(owner,'account_delete');
  assert.equal(sql(`SELECT next_attempt_at>clock_timestamp()+interval '110 seconds' FROM acharya.community_cleanup_jobs WHERE id=${quote(imageId)};`).trim(),'t');
  // Force an early sweep despite the grace to reproduce the former race exactly.
  sql(`UPDATE acharya.community_cleanup_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=${quote(imageId)};`);
  const worker={provider,operation:async(_,action,payload)=>operation('user_systemCleanup',action,payload,true)};
  assert.deepEqual(await media.cleanupCommunityMedia('',5,worker),{completed:1,failed:0});
  assert.equal(sql(`SELECT completed_at IS NOT NULL FROM acharya.community_cleanup_jobs WHERE id=${quote(imageId)};`).trim(),'t');
  allowUpload();
  await assert.rejects(upload,/ACCOUNT_DELETED/);
  assert(exists,'late provider completion must create the orphan candidate');
  assert.equal(sql(`SELECT completed_at IS NULL AND lease_token IS NULL AND next_attempt_at>clock_timestamp()+interval '110 seconds' FROM acharya.community_cleanup_jobs WHERE id=${quote(imageId)};`).trim(),'t');
  sql(`UPDATE acharya.community_cleanup_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=${quote(imageId)};`);
  assert.deepEqual(await media.cleanupCommunityMedia('',5,worker),{completed:1,failed:0});
  assert.equal(exists,false,'requeued cleanup deletes the late file');
});
