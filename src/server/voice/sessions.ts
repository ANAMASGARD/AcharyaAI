import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { query } from '../rag/db';
import { RagError, selectionSchema } from '../rag/contracts';
import { authorizeSelections } from '../rag/repository';
import { getOrCreateConversation, saveSelections } from '../rag/chat';
import { getVerification } from '../rag/verification';
import { VOICE_INSTRUCTIONS } from './prompt';

const idSchema = z.string().length(21);
export const startSchema = z.object({
 sdp:z.string().min(20).max(100000), requestId:idSchema,
 conversationId:idSchema.optional(), verificationId:idSchema.optional(), selections:selectionSchema.default([]),
});
export const eventsSchema = z.object({id:idSchema,items:z.array(z.object({
 itemId:z.string().min(1).max(160),role:z.enum(['user','assistant']),text:z.string().max(16000),interrupted:z.boolean().default(false),
})).max(20),usage:z.record(z.string(),z.unknown()).optional()});
function client() {
 const apiKey=process.env.VOICE_OPENAI_API_KEY || process.env.RAG_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
 if(!apiKey) throw new RagError('Live voice is not configured on the server.',503);
 return new OpenAI({apiKey,maxRetries:0,timeout:25000});
}
export async function activeVoice(owner:string) {
 return (await query<{id:string;status:string;expires_at:string}>("SELECT id,status,expires_at FROM acharya_rag.voice_sessions WHERE owner=$1 AND status IN ('connecting','active','ending')",[owner]))[0]??null;
}
export async function endVoice(owner:string,id:string):Promise<void> {
 const [session]=await query<{call_id:string|null;status:string}>("UPDATE acharya_rag.voice_sessions SET status=CASE WHEN status IN ('ended','failed') THEN status ELSE 'ending' END WHERE id=$1 AND owner=$2 RETURNING call_id,status",[id,owner]);
 if(!session)throw new RagError('Voice session not found.',404);
 if(session.status==='ended'||session.status==='failed')return;
 if(session.call_id)try{await client().realtime.calls.hangup(session.call_id);}catch(e){
  if(!(e instanceof OpenAI.APIError && (e.status===404||e.status===410)))throw new RagError('Could not end the server call. Retry ending it.',503);
 }
 await query("UPDATE acharya_rag.voice_sessions SET status='ended',ended_at=now() WHERE id=$1 AND owner=$2",[id,owner]);
}
export async function endConversationVoice(owner:string,conversationId:string) {
 const rows=await query<{id:string}>("SELECT id FROM acharya_rag.voice_sessions WHERE owner=$1 AND conversation_id=$2 AND status IN ('connecting','active','ending')",[owner,conversationId]);
 for(const row of rows)await endVoice(owner,row.id);
 await query("DELETE FROM acharya_rag.voice_sessions WHERE owner=$1 AND conversation_id=$2",[owner,conversationId]);
}
export async function endSourceVoice(owner:string,sourceId:string) {
 const sessions=await query<{id:string;conversation_id:string;status:string}>(`SELECT v.id,v.conversation_id,v.status FROM acharya_rag.voice_sessions v JOIN acharya_rag.conversations c ON c.id=v.conversation_id WHERE v.owner=$1 AND EXISTS(SELECT 1 FROM acharya_rag.documents d WHERE d.source_id=$2 AND (c.selections @> jsonb_build_array(jsonb_build_object('documentId',d.id)) OR c.provenance @> jsonb_build_array(jsonb_build_object('documentId',d.id))))`,[owner,sourceId]);
 for(const session of sessions)if(['connecting','active','ending'].includes(session.status))await endVoice(owner,session.id);
 if(sessions.length)await query('DELETE FROM acharya_rag.voice_sessions WHERE owner=$1 AND id=ANY($2::text[])',[owner,sessions.map(s=>s.id)]);
}
export async function startVoice(owner:string,input:z.infer<typeof startSchema>,signal:AbortSignal) {
 if(!/^m=audio /m.test(input.sdp)||/^m=video /m.test(input.sdp))throw new RagError('An audio-only connection is required.');
 const conversation=await getOrCreateConversation(owner,input.conversationId,input.requestId);
 const reviewId=input.verificationId??conversation.verificationId;
 const review=reviewId?await getVerification(owner,reviewId):undefined;
 if(review&&(review.historical||review.status!=='completed'))throw new RagError('Open a current completed paper review first.',409);
 const selections=review?.selections??input.selections;
 await authorizeSelections(owner,selections);
 await saveSelections(owner,conversation.conversationId,selections,review);
 const [context]=await query<{history:unknown;books:unknown}>(`SELECT
 (SELECT jsonb_agg(x) FROM (SELECT role,left(content,2500) AS content FROM acharya_rag.messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 12) x) history,
 (SELECT jsonb_agg(jsonb_build_object('title',d.title,'class',d.class_level,'subject',d.subject,'role',p->>'role','chapters',(SELECT jsonb_agg(DISTINCT chapter_title) FROM acharya_rag.pages WHERE document_id=d.id AND chapter_id IN (SELECT jsonb_array_elements_text(COALESCE(p->'chapterIds','[]'::jsonb)))))) FROM jsonb_array_elements($2::jsonb) p JOIN acharya_rag.documents d ON d.id=p->>'documentId') books`,[conversation.conversationId,JSON.stringify(selections)]);
 const id=nanoid();
 const rows=await query<{id:string;expires_at:string}>(`INSERT INTO acharya_rag.voice_sessions(id,owner,conversation_id,status) VALUES($1,$2,$3,'connecting') ON CONFLICT DO NOTHING RETURNING id,expires_at`,[id,owner,conversation.conversationId]);
 if(!rows.length)throw new RagError('Another voice session is active. End it before starting again.',409);
 let callId:string|undefined;
 try {
  const response=await client().realtime.calls.create({sdp:input.sdp,session:{type:'realtime',model:process.env.OPENAI_VOICE_MODEL||'gpt-realtime-2',
   instructions:VOICE_INSTRUCTIONS+'\nCONTEXT: '+JSON.stringify({...context,paperReview:review}).slice(0,36000),
   output_modalities:['audio'],max_output_tokens:1200,
   audio:{input:{transcription:{model:'gpt-4o-mini-transcribe'},turn_detection:{type:'semantic_vad',eagerness:'low',create_response:true,interrupt_response:true}},output:{voice:'shimmer'}},
  }},{signal});
  const location=response.headers.get('location');
  callId=location?.split('/').pop();
  if(!response.ok||!callId)throw new Error('Missing call identifier');
  const sdp=await response.text();
  const saved=await query<{id:string}>("UPDATE acharya_rag.voice_sessions SET call_id=$3,status='active' WHERE id=$1 AND owner=$2 AND status='connecting' AND conversation_id IS NOT NULL RETURNING id",[id,owner,callId]);
  if(!saved.length)throw new Error('Session cancelled');
  return {id,conversationId:conversation.conversationId,sdp,expiresAt:rows[0].expires_at};
 }catch(e){
  let closed=!callId;
  if(callId)try{await client().realtime.calls.hangup(callId);closed=true;}catch{/* Keep the call ID for an authenticated cleanup retry. */}
  await query("UPDATE acharya_rag.voice_sessions SET status=$3,call_id=COALESCE($4,call_id),ended_at=CASE WHEN $3='failed' THEN now() ELSE NULL END WHERE id=$1 AND owner=$2",[id,owner,closed?'failed':'ending',callId??null]);
  throw new RagError(e instanceof OpenAI.APIError&&e.status===429?'OpenAI voice is busy or its quota is exhausted.':'Could not connect to OpenAI voice. Please retry.',503);
 }
}
export async function saveVoiceEvents(owner:string,input:z.infer<typeof eventsSchema>) {
 // Client captions are private conversation records, not trusted provider receipts or verified evidence.
 const [session]=await query<{conversation_id:string|null}>("SELECT conversation_id FROM acharya_rag.voice_sessions WHERE id=$1 AND owner=$2 AND status IN ('active','ending','ended') AND created_at>now()-interval '1 hour'",[input.id,owner]);
 if(!session?.conversation_id)throw new RagError('Voice session is unavailable.',404);
 const textItems=input.items.filter(i=>i.text.trim());
 await query(`INSERT INTO acharya_rag.messages(id,conversation_id,role,content,voice_session_id,voice_item_id,interrupted,created_at)
 SELECT p->>'id',v.conversation_id,p->>'role',p->>'text',v.id,p->>'itemId',(p->>'interrupted')::boolean,now()+ordinality*interval '1 microsecond'
 FROM acharya_rag.voice_sessions v JOIN acharya_rag.conversations c ON c.id=v.conversation_id CROSS JOIN jsonb_array_elements($3::jsonb) WITH ORDINALITY AS entries(p,ordinality)
 WHERE v.id=$1 AND v.owner=$2 AND c.owner=$2
 ON CONFLICT(voice_session_id,voice_item_id) WHERE voice_session_id IS NOT NULL DO UPDATE SET content=excluded.content,interrupted=excluded.interrupted`,[input.id,owner,JSON.stringify(textItems.map(i=>({...i,id:nanoid()})))]);
 if(input.usage)await query("UPDATE acharya_rag.voice_sessions SET usage=$3::jsonb WHERE id=$1 AND owner=$2",[input.id,owner,JSON.stringify(input.usage)]);
 return {ok:true};
}
