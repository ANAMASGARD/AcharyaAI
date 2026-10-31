import { nanoid } from "nanoid";
import type {
  ChatConversation,
  ChatConversationSummary,
  ChatMessage,
} from "../../types/chat";
import type { Citation, SourceSelection } from "../../types/rag";
import { query, sqlClient } from "./db";
import { RagError } from "./contracts";

type ConversationRow = {
  id: string;
  verification_id: string | null;
  created_at: string;
  selections: SourceSelection[];
};
function conversation(r: ConversationRow): ChatConversation {
  return {
    conversationId: r.id,
    createdAt: r.created_at,
    contextSnapshot: "",
    verificationId: r.verification_id,
    selections: r.selections,
  };
}
export async function createConversation(
  owner: string,
  requestId?: string,
): Promise<ChatConversation> {
  const [r] = await query<ConversationRow>(
    `INSERT INTO acharya_rag.conversations(id,owner,initial_request) VALUES($1,$2,$3) ON CONFLICT(owner,initial_request) WHERE initial_request IS NOT NULL DO UPDATE SET initial_request=excluded.initial_request RETURNING *`,
    [nanoid(), owner, requestId ?? null],
  );
  return conversation(r);
}
export async function getConversationForTeacher(
  owner: string,
  id: string,
): Promise<ChatConversation | null> {
  const [r] = await query<ConversationRow>(
    "SELECT * FROM acharya_rag.conversations WHERE id=$1 AND owner=$2",
    [id, owner],
  );
  return r ? conversation(r) : null;
}
export async function getLatestConversationForTeacher(
  owner: string,
): Promise<ChatConversation | null> {
  const [r] = await query<ConversationRow>(
    "SELECT * FROM acharya_rag.conversations WHERE owner=$1 ORDER BY created_at DESC LIMIT 1",
    [owner],
  );
  return r ? conversation(r) : null;
}
export async function getOrCreateConversation(
  owner: string,
  id?: string,
  requestId?: string,
): Promise<ChatConversation> {
  if (!id) return createConversation(owner, requestId);
  const found = await getConversationForTeacher(owner, id);
  if (!found)
    throw new RagError(
      "Chat unavailable. Older Neo4j chats are not imported; start a new chat.",
      404,
    );
  return found;
}
export async function listConversationsForTeacher(
  owner: string,
): Promise<ChatConversationSummary[]> {
  return query<ChatConversationSummary>(
    `SELECT c.id AS "conversationId",c.created_at AS "createdAt",c.title,
 (SELECT count(*)::int FROM acharya_rag.messages m WHERE m.conversation_id=c.id) AS "messageCount",
 COALESCE((SELECT left(content,120) FROM acharya_rag.messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1),'') preview
 FROM acharya_rag.conversations c WHERE owner=$1 ORDER BY created_at DESC LIMIT 100`,
    [owner],
  );
}
export async function listMessages(
  owner: string,
  id: string,
  limit = 50,
): Promise<ChatMessage[]> {
  return query<ChatMessage>(
    `SELECT * FROM (SELECT m.id AS "messageId",m.role,m.content,m.citations,m.request_hash AS "requestHash",m.created_at AS "createdAt" FROM acharya_rag.messages m JOIN acharya_rag.conversations c ON c.id=m.conversation_id WHERE c.id=$1 AND c.owner=$2 ORDER BY m.created_at DESC,m.id DESC LIMIT $3) recent ORDER BY "createdAt","messageId"`,
    [id, owner, limit],
  );
}
export async function appendMessage(
  owner: string,
  id: string,
  role: "user" | "assistant",
  content: string,
  citations: Citation[] = [],
  requestId?: string,
  requestHash?: string,
): Promise<ChatMessage> {
  const [r] = await query<ChatMessage>(
    `INSERT INTO acharya_rag.messages(id,conversation_id,role,content,citations,request_id,request_hash) SELECT $1,c.id,$4,$5,$6::jsonb,$7,$8 FROM acharya_rag.conversations c WHERE c.id=$2 AND c.owner=$3 ON CONFLICT(conversation_id,request_id,role) WHERE request_id IS NOT NULL DO UPDATE SET request_id=excluded.request_id WHERE acharya_rag.messages.request_hash IS NOT DISTINCT FROM excluded.request_hash RETURNING id AS "messageId",role,content,citations,created_at AS "createdAt"`,
    [
      nanoid(),
      id,
      owner,
      role,
      content,
      JSON.stringify(citations),
      requestId ?? null,
      requestHash ?? null,
    ],
  );
  if (!r) throw new RagError("Chat was deleted.", 404);
  if (role === "user" && r.content !== content)
    throw new RagError(
      "Request ID was already used for different content.",
      409,
    );
  return r;
}
export async function saveSelections(
  owner: string,
  id: string,
  selections: SourceSelection[],
  review?: { id: string; paperId: string },
): Promise<void> {
  const sql = sqlClient();
  const ids = [
    ...new Set([
      ...selections.map((s) => s.documentId),
      ...(review ? [review.paperId] : []),
    ]),
  ];
  const provenance = [
    ...selections,
    ...(review ? [{ documentId: review.paperId }] : []),
  ];
  const result = await sql.transaction([
    sql.query(
      "SELECT s.id FROM acharya_rag.sources s JOIN acharya_rag.documents d ON d.source_id=s.id WHERE d.id=ANY($1::text[]) ORDER BY s.id FOR UPDATE OF s",
      [ids],
    ),
    sql.query(
      `UPDATE acharya_rag.conversations SET selections=$3::jsonb,verification_id=$6,provenance=(SELECT COALESCE(jsonb_agg(DISTINCT p),'[]') FROM jsonb_array_elements(provenance||$7::jsonb) p) WHERE id=$1 AND owner=$2 AND (SELECT count(*) FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id WHERE d.id=ANY($4::text[]) AND s.deleted_at IS NULL AND (s.active_version=d.id OR (d.owner=$2 AND d.kind='paper' AND EXISTS(SELECT 1 FROM acharya_rag.verifications v WHERE v.id=$6 AND v.owner=$2 AND v.paper_id=d.id AND v.status='completed'))) AND (d.owner=$2 OR d.owner IS NULL))=$5 AND ($6::text IS NULL OR EXISTS(SELECT 1 FROM acharya_rag.verifications WHERE id=$6 AND owner=$2 AND status='completed')) RETURNING id`,
      [
        id,
        owner,
        JSON.stringify(selections),
        ids,
        ids.length,
        review?.id ?? null,
        JSON.stringify(provenance),
      ],
    ),
  ]);
  if (!result[1].length)
    throw new RagError("Chat or sources changed or were deleted.", 409);
}
export async function claimChat(owner: string, id: string): Promise<string> {
  const token = nanoid();
  const rows = await query(
    `UPDATE acharya_rag.conversations SET request_token=$3,request_until=now()+interval '10 minutes' WHERE id=$1 AND owner=$2 AND (request_until IS NULL OR request_until<now()) RETURNING id`,
    [id, owner, token],
  );
  if (!rows.length)
    throw new RagError(
      "A response is already in progress. Retry shortly.",
      409,
    );
  return token;
}
export async function releaseChat(
  owner: string,
  id: string,
  token: string,
): Promise<void> {
  await query(
    "UPDATE acharya_rag.conversations SET request_token=NULL,request_until=NULL WHERE id=$1 AND owner=$2 AND request_token=$3",
    [id, owner, token],
  );
}
export async function requestMessages(
  owner: string,
  id: string,
  requestId: string,
): Promise<(ChatMessage & { requestHash: string | null })[]> {
  return query(
    `SELECT m.id AS "messageId",m.role,m.content,m.citations,m.request_hash AS "requestHash",m.created_at AS "createdAt" FROM acharya_rag.messages m JOIN acharya_rag.conversations c ON c.id=m.conversation_id WHERE c.id=$1 AND c.owner=$2 AND m.request_id=$3 ORDER BY m.created_at`,
    [id, owner, requestId],
  );
}

export async function deleteConversationForTeacher(
  owner: string,
  id: string,
): Promise<boolean> {
  return (
    (
      await query(
        "DELETE FROM acharya_rag.conversations WHERE id=$1 AND owner=$2 RETURNING id",
        [id, owner],
      )
    ).length > 0
  );
}
export async function updateConversationTitleForTeacher(
  owner: string,
  id: string,
  title: string,
): Promise<string> {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 80)
    throw new RagError("Title must contain 1–80 characters.");
  if (
    !(
      await query(
        "UPDATE acharya_rag.conversations SET title=$3 WHERE id=$1 AND owner=$2 RETURNING id",
        [id, owner, trimmed],
      )
    ).length
  )
    throw new RagError("Chat not found.", 404);
  return trimmed;
}

export async function renewChat(
  owner: string,
  id: string,
  token: string,
): Promise<void> {
  const rows = await query(
    `UPDATE acharya_rag.conversations SET request_until=now()+interval '6 minutes' WHERE id=$1 AND owner=$2 AND request_token=$3 AND request_until>now() RETURNING id`,
    [id, owner, token],
  );
  if (!rows.length)
    throw new RagError(
      "This chat request was cancelled, deleted, or replaced.",
      409,
    );
}
