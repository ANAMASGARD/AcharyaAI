import { query, sqlClient } from "./db";
import { RagError } from "./contracts";
import { embedTexts } from "./openai";
import {
  claimSource,
  failSource,
  finishExtraction,
  getSource,
} from "./repository";
import type { Source } from "../../types/rag";
export async function processSource(
  owner: string | null,
  id: string,
  signal?: AbortSignal,
): Promise<Source> {
  const current = await getSource(owner, id);
  if (current.status === "ready") return current;
  if (current.extractedCount < current.pageCount)
    throw new RagError("Select the same file again to finish extraction.", 409);
  if (current.unresolvedCount)
    throw new RagError(
      "Unresolved pages require a clearer file or manual review.",
      422,
    );
  if (!current.chunkCount) {
    await finishExtraction(owner, id);
    return getSource(owner, id);
  }
  // Papers are evaluation targets, never retrieval sources. A recovered paper
  // is ready after finalizing saved text, with no embedding request or lease.
  if (current.kind === "paper") return getSource(owner, id);
  const token = await claimSource(owner, id, "embed");
  try {
    const batch = await query<{ id: string; text: string }>(
      "SELECT id,text FROM acharya_rag.chunks WHERE document_id=$1 AND embedding IS NULL ORDER BY position LIMIT 16",
      [id],
    );
    const vectors = await embedTexts(
      batch.map((c) => c.text),
      signal,
    );
    const sql = sqlClient();
    await sql.transaction([
      sql.query(
        "SELECT s.id FROM acharya_rag.sources s JOIN acharya_rag.documents d ON d.source_id=s.id WHERE d.id=$1 AND s.deleted_at IS NULL FOR UPDATE OF s",
        [id],
      ),
      ...batch.map((c, i) =>
        sql.query(
          `UPDATE acharya_rag.chunks SET embedding=$1::vector WHERE id=$2 AND document_id=$3 AND EXISTS(SELECT 1 FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id WHERE d.id=$3 AND d.lease_token=$4 AND s.deleted_at IS NULL)`,
          [JSON.stringify(vectors[i]), c.id, id, token],
        ),
      ),
      sql.query(
        `UPDATE acharya_rag.documents d SET status=CASE WHEN
    (SELECT count(*) FROM acharya_rag.chunks WHERE document_id=$1 AND embedding IS NOT NULL)=d.chunk_count AND d.chunk_count>0
    AND (SELECT count(*) FROM acharya_rag.pages WHERE document_id=$1 AND outcome IN ('extracted','blank'))=d.page_count
    AND d.extracted_count=d.page_count THEN 'ready' ELSE 'pending' END,
    lease_token=NULL,lease_until=NULL,attempts=0,next_attempt_at=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2`,
        [id, token],
      ),
      sql.query(
        `UPDATE acharya_rag.sources s SET active_version=d.id FROM acharya_rag.documents d WHERE d.id=$1 AND d.source_id=s.id AND d.status='ready' AND s.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM acharya_rag.documents newer WHERE newer.source_id=s.id AND newer.status='ready' AND newer.created_at>d.created_at)`,
        [id],
      ),
    ]);
  } catch (error) {
    await failSource(id, token, error);
    throw error;
  }
  return getSource(owner, id);
}
