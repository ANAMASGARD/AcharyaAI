import {describe,it,expect,beforeAll,afterAll}from'vitest';import{readFileSync}from'node:fs';import{parseEnv}from'node:util';
import {createConversation,appendMessage,requestMessages,claimChat,releaseChat}from'@/server/rag/chat';import{query}from'@/server/rag/db';
describe.skipIf(process.env.RAG_INTEGRATION!=='1')('chat request identity',()=>{
 const owner='chat-request-test-'+Date.now();beforeAll(()=>Object.assign(process.env,parseEnv(readFileSync('.env','utf8'))));afterAll(async()=>{await query('DELETE FROM acharya_rag.conversations WHERE owner=$1',[owner]);});
 it('deduplicates requests and rejects changed message or sources at the database boundary',async()=>{
  const c=await createConversation(owner,'initial-request');expect((await createConversation(owner,'initial-request')).conversationId).toBe(c.conversationId);
  const lease=await claimChat(owner,c.conversationId);await expect(claimChat(owner,c.conversationId)).rejects.toThrow('progress');
  const message=await appendMessage(owner,c.conversationId,'user','Question',[],'request-id','source-scope-a');
  expect((await appendMessage(owner,c.conversationId,'user','Question',[],'request-id','source-scope-a')).messageId).toBe(message.messageId);
  await expect(appendMessage(owner,c.conversationId,'user','Changed',[],'request-id','source-scope-a')).rejects.toThrow('different');
  await expect(appendMessage(owner,c.conversationId,'user','Question',[],'request-id','source-scope-b')).rejects.toThrow();
  expect((await requestMessages(owner,c.conversationId,'request-id'))[0].requestHash).toBe('source-scope-a');await releaseChat(owner,c.conversationId,lease);
 },30000);
});
