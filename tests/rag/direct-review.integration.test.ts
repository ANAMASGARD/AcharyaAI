import fs from 'node:fs';import {parseEnv} from 'node:util';
import {expect,it,vi} from 'vitest';
import {nanoid} from 'nanoid';
import {createSource,deleteSource} from '@/server/rag/repository';
import {directReview} from '@/server/rag/direct-review';
import {getVerification} from '@/server/rag/verification';
vi.mock('@/server/rag/openai',()=>({structured:vi.fn(async(name:string)=>name==='review_chat_selection'?{focus:'all',indexes:[]}:({needsReview:false,questions:[{number:'1',text:'Explain water cycle.',page:1,endPage:1,sharedContext:'',marks:null,extractionCompleteness:'complete',status:'needs_review',explanation:'Choose a book.',suggestion:'Select the syllabus.'}]}))}));
it.skipIf(process.env.RAG_INTEGRATION!=='1')('saves and reloads a direct review and deletes it with its private paper',async()=>{
 Object.assign(process.env,parseEnv(fs.readFileSync('.env','utf8')));
 const owner='direct-integration-'+nanoid();let id:string|undefined;
 try{const source=await createSource(owner,{title:'Test paper',kind:'paper',hash:owner,pages:[{number:1,text:'Explain water cycle.'}]});id=source.id;const f=new FormData();f.append('id',id);f.append('selections','[]');const report=await directReview(owner,f);
 expect(report.status).toBe('completed');expect((await getVerification(owner,report.id)).basis).toBe('book_title_estimate');await expect(getVerification(owner+'other',report.id)).rejects.toThrow('not found');
 await deleteSource(owner,id);id=undefined;await expect(getVerification(owner,report.id)).rejects.toThrow('not found');
 await expect(createSource(owner,{title:'Stale attempt',kind:'paper',hash:owner,pages:[{number:1,text:'Explain water cycle.'}]})).rejects.toThrow('deleted');
 const replacement=await createSource(owner,{title:'Uploaded again',kind:'paper',hash:owner,uploadAttempt:nanoid(),pages:[{number:1,text:'Explain water cycle.'}]});id=replacement.id;expect(id).not.toBe(source.id);
 }finally{if(id)await deleteSource(owner,id)}
});

it.skipIf(process.env.RAG_INTEGRATION!=='1')('reviews original bytes without extraction and carries the saved report into owned chat',async()=>{
 Object.assign(process.env,parseEnv(fs.readFileSync('.env','utf8')));
 const {beginSource,digest}=await import('@/server/rag/repository');
 const {createConversation,saveSelections,getConversationForTeacher}=await import('@/server/rag/chat');
 const {query}=await import('@/server/rag/db');
 const owner='raw-paper-'+nanoid();const bytes=new Uint8Array([1,2,3]);
 const paper=await beginSource(owner,{title:'Unextracted photo',kind:'paper',hash:digest(bytes),files:[{id:nanoid(),name:'paper.png',title:'Paper',hash:digest(bytes),pages:1,offset:0}]});
 try{
  await query("UPDATE acharya_rag.documents SET status='failed',error='Some pages remain unreadable. This source cannot be published.' WHERE id=$1 AND owner=$2",[paper.id,owner]);
  const f=new FormData();f.append('id',paper.id);f.append('selections','[]');f.append('file',new Blob([bytes],{type:'image/png'}));
  const report=await directReview(owner,f);expect(report.status).toBe('completed');
  const chat=await createConversation(owner);await saveSelections(owner,chat.conversationId,[],{id:report.id,paperId:paper.id});
  expect((await getConversationForTeacher(owner,chat.conversationId))?.verificationId).toBe(report.id);
  const {directReviewChat}=await import('@/server/rag/direct-review-chat');
  const requestId=nanoid();const signal=new AbortController().signal;
  const response=await directReviewChat(owner,chat.conversationId,report.id,requestId,'Explain the review',signal);
  const stream=await response.text();expect(stream).toContain('"type":"done"');expect(stream).not.toContain('"type":"error"');
  const retry=await directReviewChat(owner,chat.conversationId,report.id,requestId,'Explain the review',signal);expect(await retry.text()).toContain('"type":"done"');
  await expect(directReviewChat(owner,chat.conversationId,report.id,requestId,'Changed message',signal)).rejects.toThrow('request ID');
  await expect(saveSelections(owner+'other',chat.conversationId,[],{id:report.id,paperId:paper.id})).rejects.toThrow();
  await deleteSource(owner,paper.id);expect(await getConversationForTeacher(owner,chat.conversationId)).toBeNull();
 }finally{await deleteSource(owner,paper.id)}
});
