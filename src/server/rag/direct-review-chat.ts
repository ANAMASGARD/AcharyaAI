import { nanoid } from "nanoid";
import { sqlClient } from "./db";
import { authorizedReview, discussReview } from "./review-chat";
import { requestMessages, saveSelections } from "./chat";
import { digest } from "./repository";
import { RagError } from "./contracts";
import { failure } from "./http";
import type { ChatMessage } from "../../types/chat";

// One authorization, one model call and one atomic save keep saved-review chat
// within EAS's request budget. No content is streamed before the final ownership
// and deletion checks. Conflicting/concurrent retries return the stored answer.
export async function directReviewChat(
  owner: string,
  conversationId: string,
  verificationId: string,
  requestId: string,
  message: string,
  signal: AbortSignal,
): Promise<Response> {
  const review = await authorizedReview(owner, verificationId);
  const hash = digest(JSON.stringify([message, verificationId, review.selections]));
  const existing = await requestMessages(owner, conversationId, requestId);
  if (existing.some(m => m.requestHash !== hash))
    throw new RagError("Use a new request ID for a different message.", 409);
  const completed = existing.find(m => m.role === "assistant");
  const encode = (messages: ChatMessage[]) => {
    const assistant = messages.find(m => m.role === "assistant")!;
    const user = messages.find(m => m.role === "user")!;
    return [{type:"delta",content:assistant.content},{type:"done",conversationId,messageId:assistant.messageId,userMessageId:user.messageId,citations:assistant.citations}];
  };
  const headers = {"Content-Type":"application/x-ndjson","Cache-Control":"no-store"};
  if (completed) return new Response(encode(existing).map(e=>JSON.stringify(e)).join("\n")+"\n",{headers});
  await saveSelections(owner, conversationId, review.selections, review);
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: unknown) => { if (!signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event)+"\n")); };
      try {
        write({type:"progress",message:"Reading your saved paper review…"});
        const answer = await discussReview(message, review, async () => {}, signal);
        signal.throwIfAborted();
        const sql = sqlClient();
        const ids = [...review.selections.map(s=>s.documentId),review.paperId];
        const insert = `INSERT INTO acharya_rag.messages(id,conversation_id,role,content,citations,request_id,request_hash)
          SELECT $1,c.id,$4,$5,$6::jsonb,$7,$8 FROM acharya_rag.conversations c
          JOIN acharya_rag.verifications v ON v.id=c.verification_id AND v.owner=c.owner
          WHERE c.id=$2 AND c.owner=$3 AND v.id=$9 AND v.status='completed'
          AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v.selections) pick LEFT JOIN acharya_rag.documents d ON d.id=pick->>'documentId' LEFT JOIN acharya_rag.sources s ON s.id=d.source_id WHERE d.id IS NULL OR s.deleted_at IS NOT NULL OR s.active_version IS DISTINCT FROM d.id)
          AND EXISTS(SELECT 1 FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id WHERE d.id=v.paper_id AND d.owner=c.owner AND s.deleted_at IS NULL)
          ON CONFLICT(conversation_id,request_id,role) WHERE request_id IS NOT NULL DO UPDATE SET request_id=excluded.request_id WHERE acharya_rag.messages.request_hash=excluded.request_hash
          RETURNING id AS "messageId",role,content,citations,request_hash AS "requestHash"`;
        const result = await sql.transaction([
          sql.query("SELECT s.id FROM acharya_rag.sources s JOIN acharya_rag.documents d ON d.source_id=s.id WHERE d.id=ANY($1::text[]) ORDER BY s.id FOR UPDATE OF s",[ids]),
          sql.query("SELECT id FROM acharya_rag.conversations WHERE id=$1 AND owner=$2 FOR UPDATE",[conversationId,owner]),
          sql.query(insert,[nanoid(),conversationId,owner,"user",message,"[]",requestId,hash,verificationId]),
          sql.query(insert,[nanoid(),conversationId,owner,"assistant",answer.content,JSON.stringify(answer.citations),requestId,hash,verificationId]),
        ]);
        if (!result[2].length || !result[3].length) throw new RagError("The paper review changed or was removed. Open it again.",409);
        for (const event of encode([...result[2],...result[3]] as ChatMessage[])) write(event);
      } catch(error) {
        if (!signal.aborted) write({type:"error",...(await failure(error).json())});
      } finally { controller.close(); }
    },
  }),{headers});
}
