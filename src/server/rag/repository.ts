import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { query, sqlClient } from "./db";
import {
  EMBEDDING_PROFILE,
  EXTRACTION_VERSION,
  CHUNKING_VERSION,
  makeChunks,
  RagError,
  type ExtractedPage,
} from "./contracts";
import type { Source, SourceSelection } from "../../types/rag";

export const digest = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
export const textIdentity = (pages: ExtractedPage[]): string =>
  digest(
    pages
      .map((p) => p.text)
      .join(" ")
      .normalize("NFKC")
      .replace(/\s+/gu, " ")
      .trim(),
  );
export type SourceFile = {
  id: string;
  name: string;
  hash: string;
  textHash?: string;
  pages: number;
  offset: number;
  title: string;
};
export type SourceInput = {
  uploadAttempt?: string;
  title: string;
  kind: Source["kind"];
  hash: string;
  classLevel?: string;
  subject?: string;
  catalogKey?: string;
  edition?: string;
  files: SourceFile[];
};
type SourceRow = {
  id: string;
  source_id: string;
  owner: string | null;
  title: string;
  kind: Source["kind"];
  class_level: string | null;
  subject: string | null;
  status: Source["status"];
  error: string | null;
  page_count: number;
  extracted_count: number;
  chunk_count: number;
  embedded_count: number;
  chapters: Source["chapters"];
  created_at: string;
  active_version: string | null;
  unresolved_count: number;
  files: SourceFile[];
};
const sourceSelect = `SELECT d.*,s.active_version,
 (SELECT count(*)::int FROM acharya_rag.chunks c WHERE c.document_id=d.id AND c.embedding IS NOT NULL) embedded_count,
 (SELECT count(*)::int FROM acharya_rag.pages p WHERE p.document_id=d.id AND p.outcome='unresolved') unresolved_count,
 COALESCE((SELECT jsonb_agg(ch) FROM (SELECT DISTINCT chapter_id id,chapter_title title FROM acharya_rag.pages WHERE document_id=d.id AND chapter_id IS NOT NULL) ch),'[]') chapters
 FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id AND s.deleted_at IS NULL`;
function source(row: SourceRow): Source {
  return {
    id: row.id,
    sourceId: row.source_id,
    versionId: row.id,
    active: row.active_version === row.id,
    title: row.title,
    kind: row.kind,
    shared: row.owner === null,
    classLevel: row.class_level,
    subject: row.subject,
    status: row.status,
    error: row.error,
    pageCount: row.page_count,
    extractedCount: row.extracted_count,
    unresolvedCount: row.unresolved_count,
    chunkCount: row.chunk_count,
    embeddedCount: row.embedded_count,
    chapters: row.chapters,
    createdAt: row.created_at,
  };
}
export async function listSources(
  owner: string,
  includePapers = false,
): Promise<Source[]> {
  return (
    await query<SourceRow>(
      `${sourceSelect} WHERE ((d.owner=$1 AND (d.status<>'ready' OR s.active_version=d.id)) OR (d.owner IS NULL AND s.active_version=d.id AND COALESCE(d.catalog_key,'') NOT LIKE 'pilot:%')) AND ($2 OR d.kind='reference') ORDER BY d.created_at DESC`,
      [owner, includePapers],
    )
  ).map(source);
}
export async function getSource(
  owner: string | null,
  id: string,
): Promise<Source> {
  const [row] = await query<SourceRow>(
    `${sourceSelect} WHERE d.id=$1 AND (d.owner=$2 OR (d.owner IS NULL AND ($2::text IS NULL OR s.active_version=d.id)))`,
    [id, owner],
  );
  if (!row) throw new RagError("Source not found.", 404);
  return source(row);
}
export async function authorizeSelections(
  owner: string,
  selections: SourceSelection[],
): Promise<void> {
  if (!selections.length) return;
  const rows = await query<{ id: string; chapters_valid: boolean }>(
    `SELECT d.id, NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(pick->'chapterIds','[]'::jsonb)) chapter
      WHERE NOT EXISTS(SELECT 1 FROM acharya_rag.pages p WHERE p.document_id=d.id AND p.chapter_id=chapter)
    ) chapters_valid
    FROM jsonb_array_elements($1::jsonb) pick
    JOIN acharya_rag.documents d ON d.id=pick->>'documentId'
    JOIN acharya_rag.sources s ON s.id=d.source_id
    WHERE (d.owner=$2 OR d.owner IS NULL) AND d.status='ready' AND d.kind='reference'
    AND d.profile=$3 AND s.active_version=d.id AND s.deleted_at IS NULL`,
    [JSON.stringify(selections), owner, EMBEDDING_PROFILE],
  );
  if (rows.length !== selections.length)
    throw new RagError("A selected reference is unavailable, historical, or still processing.", 409);
  if (rows.some(row => !row.chapters_valid))
    throw new RagError("A selected chapter does not belong to that source.");

}
export async function beginSource(
  owner: string | null,
  input: SourceInput,
): Promise<Source> {
  if (
    !input.files.length ||
    input.files.some((f) => f.pages < 1 || f.offset < 0) ||
    new Set(input.files.map((f) => f.id)).size !== input.files.length
  )
    throw new RagError("Invalid source manifest.");
  let offset = 0;
  for (const f of input.files) {
    if (f.offset !== offset) throw new RagError("Invalid page offsets.");
    offset += f.pages;
  }
  const identity = digest(
    JSON.stringify([
      owner,
      input.kind,
      input.catalogKey ?? input.hash,
      input.classLevel ?? null,
      input.subject ?? null,
      ...(owner && input.kind === "paper" && input.uploadAttempt ? [input.uploadAttempt] : []),
    ]),
  );
  const dedup = digest(
    JSON.stringify([
      identity,
      input.hash,
      EXTRACTION_VERSION,
      CHUNKING_VERSION,
      EMBEDDING_PROFILE,
    ]),
  );
  const rows = await query<{ id: string }>(
    `WITH source AS (
 INSERT INTO acharya_rag.sources(id,owner,identity_key) VALUES($1,$2,$3)
 ON CONFLICT(identity_key) DO UPDATE SET identity_key=excluded.identity_key WHERE acharya_rag.sources.deleted_at IS NULL RETURNING id
 ) INSERT INTO acharya_rag.documents(id,source_id,owner,title,kind,class_level,subject,catalog_key,edition,content_hash,dedup_key,profile,status,page_count,chunk_count,files,extraction_version,chunking_version)
 SELECT $4,source.id,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,'needs_reupload',$14,0,$15::jsonb,$16,$17 FROM source
 ON CONFLICT(dedup_key) DO UPDATE SET dedup_key=excluded.dedup_key RETURNING id`,
    [
      nanoid(),
      owner,
      identity,
      nanoid(),
      input.title,
      input.kind,
      input.classLevel ?? null,
      input.subject ?? null,
      input.catalogKey ?? null,
      input.edition ?? null,
      input.hash,
      dedup,
      EMBEDDING_PROFILE,
      offset,
      JSON.stringify(input.files),
      EXTRACTION_VERSION,
      CHUNKING_VERSION,
    ],
  );
  if (!rows[0])
    throw new RagError(
      "This source was deleted. A stale upload cannot recreate it.",
      409,
    );
  return getSource(owner, rows[0].id);
}
export async function claimSource(
  owner: string | null,
  id: string,
  stage: "extract" | "embed",
): Promise<string> {
  const token = nanoid();
  const claimed = await query<{ id: string }>(
    `UPDATE acharya_rag.documents d SET lease_token=$3,lease_until=now()+interval '300 seconds',status=$4,error=NULL,attempts=attempts+1,updated_at=now()
 WHERE id=$1 AND owner IS NOT DISTINCT FROM $2 AND profile=$5 AND status<>'ready' AND attempts<5 AND (lease_until IS NULL OR lease_until<now()) AND (next_attempt_at IS NULL OR next_attempt_at<=now())
 AND EXISTS(SELECT 1 FROM acharya_rag.sources s WHERE s.id=d.source_id AND s.deleted_at IS NULL)
 AND ($6='extract' AND (extracted_count<page_count OR EXISTS(SELECT 1 FROM acharya_rag.pages p WHERE p.document_id=d.id AND p.outcome='unresolved')) OR $6='embed' AND extracted_count=page_count)
 RETURNING id`,
    [
      id,
      owner,
      token,
      stage === "extract" ? "extracting" : "processing",
      EMBEDDING_PROFILE,
      stage,
    ],
  );
  if (!claimed.length)
    throw new RagError(
      "Source unavailable, retry delay active, five attempts exhausted, or another request is processing it.",
      409,
    );
  return token;
}
export async function failSource(
  id: string,
  token: string,
  error: unknown,
  extraction = false,
): Promise<void> {
  const delay = error instanceof RagError ? error.retryAfter : undefined;
  await query(
    `UPDATE acharya_rag.documents SET status=$4,error=$3,lease_token=NULL,lease_until=NULL,next_attempt_at=now()+make_interval(secs=>GREATEST(COALESCE($5::double precision,0),LEAST(30,power(2,attempts)))),updated_at=now() WHERE id=$1 AND lease_token=$2`,
    [
      id,
      token,
      error instanceof RagError
        ? error.message
        : extraction
          ? "Extraction interrupted. Select the same file to resume."
          : "Processing interrupted. Retry from saved text.",
      extraction ? "needs_reupload" : "failed",
      delay ?? null,
    ],
  );
}
export async function saveExtractionBatch(
  owner: string | null,
  id: string,
  token: string,
  pages: ExtractedPage[],
): Promise<void> {
  const rows = pages.map((p) => ({
    id: nanoid(),
    number: p.number,
    source_page: p.sourcePage ?? p.number,
    text: p.text,
    chapter_id: p.chapterId ?? null,
    chapter_title: p.chapterTitle ?? null,
    method: p.method ?? "text",
    outcome: p.outcome ?? (p.text.trim() ? "extracted" : "unresolved"),
    printed_label: p.printedLabel ?? null,
  }));
  const sql = sqlClient();
  await sql.transaction([
    sql.query(
      "SELECT s.id FROM acharya_rag.sources s JOIN acharya_rag.documents d ON d.source_id=s.id WHERE d.id=$1 AND s.deleted_at IS NULL FOR UPDATE OF s",
      [id],
    ),
    sql.query(
      `INSERT INTO acharya_rag.pages(id,document_id,number,source_page,text,chapter_id,chapter_title,method,outcome,printed_label)
 SELECT v.id,d.id,v.number,v.source_page,v.text,v.chapter_id,v.chapter_title,v.method,v.outcome,v.printed_label FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id
 CROSS JOIN jsonb_to_recordset($4::jsonb) AS v(id text,number int,source_page int,text text,chapter_id text,chapter_title text,method text,outcome text,printed_label text)
 WHERE d.id=$1 AND d.owner IS NOT DISTINCT FROM $2 AND d.lease_token=$3 AND s.deleted_at IS NULL AND v.number BETWEEN 1 AND d.page_count
 ON CONFLICT(document_id,number) DO UPDATE SET text=excluded.text,method=excluded.method,outcome=excluded.outcome,printed_label=excluded.printed_label`,
      [id, owner, token, JSON.stringify(rows)],
    ),
    sql.query(
      `UPDATE acharya_rag.documents SET extracted_count=(SELECT count(*) FROM acharya_rag.pages WHERE document_id=$1),status='needs_reupload',lease_token=NULL,lease_until=NULL,attempts=CASE WHEN EXISTS(SELECT 1 FROM acharya_rag.pages WHERE document_id=$1 AND outcome='unresolved') THEN attempts ELSE 0 END,error=CASE WHEN EXISTS(SELECT 1 FROM acharya_rag.pages WHERE document_id=$1 AND outcome='unresolved') THEN 'Unresolved pages require review; this source is not published.' ELSE NULL END,next_attempt_at=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2`,
      [id, token],
    ),
  ]);
}
export async function finishExtraction(
  owner: string | null,
  id: string,
): Promise<void> {
  const [d] = await query<{
    page_count: number;
    files: SourceFile[];
    kind: string;
  }>(
    `SELECT d.* FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id WHERE d.id=$1 AND d.owner IS NOT DISTINCT FROM $2 AND s.deleted_at IS NULL`,
    [id, owner],
  );
  if (!d) throw new RagError("Source was deleted.", 404);
  const pages = await query<ExtractedPage & { outcome: string }>(
    `SELECT number,source_page AS "sourcePage",text,chapter_id AS "chapterId",chapter_title AS "chapterTitle",method,outcome FROM acharya_rag.pages WHERE document_id=$1 ORDER BY number`,
    [id],
  );
  if (pages.length !== d.page_count) return;
  if (pages.some((p, i) => p.number !== i + 1 || p.outcome === "unresolved"))
    throw new RagError(
      "Unresolved pages block publication. Re-upload a clearer source for review.",
      422,
    );
  for (const f of d.files)
    if (pages.filter((p) => p.chapterId === f.id).length !== f.pages)
      throw new RagError("Chapter page counts do not reconcile.", 422);
  const chunks = makeChunks(pages);
  if (!chunks.length)
    throw new RagError("No readable content was extracted.", 422);
  const rows = chunks.map((c) => ({
    id: nanoid(),
    page: c.page,
    source_page: c.sourcePage,
    position: c.index,
    text: c.text,
    chapter_id: c.chapterId,
    chapter_title: c.chapterTitle,
  }));
  const sql = sqlClient();
  await sql.transaction([
    sql.query(
      "SELECT s.id FROM acharya_rag.sources s JOIN acharya_rag.documents d ON d.source_id=s.id WHERE d.id=$1 AND s.deleted_at IS NULL FOR UPDATE OF s",
      [id],
    ),
    sql.query(
      `INSERT INTO acharya_rag.chunks(id,document_id,page,source_page,position,text,chapter_id,chapter_title)
 SELECT v.id,d.id,v.page,v.source_page,v.position,v.text,v.chapter_id,v.chapter_title FROM acharya_rag.documents d JOIN acharya_rag.sources s ON s.id=d.source_id CROSS JOIN jsonb_to_recordset($2::jsonb) AS v(id text,page int,source_page int,position int,text text,chapter_id text,chapter_title text)
 WHERE d.id=$1 AND s.deleted_at IS NULL ON CONFLICT(document_id,position) DO NOTHING`,
      [id, JSON.stringify(rows)],
    ),
    sql.query(
      `UPDATE acharya_rag.documents d SET text_hash=$2,chunk_count=$3,files=$4::jsonb,status=CASE WHEN kind='paper' THEN 'ready' WHEN status='ready' THEN status ELSE 'pending' END,updated_at=now() WHERE id=$1 AND EXISTS(SELECT 1 FROM acharya_rag.sources s WHERE s.id=d.source_id AND s.deleted_at IS NULL)`,
      [
        id,
        textIdentity(pages),
        chunks.length,
        JSON.stringify(
          d.files.map((f) => ({
            ...f,
            textHash: textIdentity(pages.filter((p) => p.chapterId === f.id)),
          })),
        ),
      ],
    ),
    sql.query(
      `UPDATE acharya_rag.sources s SET active_version=d.id FROM acharya_rag.documents d WHERE d.id=$1 AND d.source_id=s.id AND d.kind='paper' AND d.status='ready' AND s.deleted_at IS NULL`,
      [id],
    ),
  ]);
}
// Convenience for fixtures and already extracted sources; production uploads use begin/save/finish.
export async function createSource(
  owner: string | null,
  input: Omit<SourceInput, "files"> & { pages: ExtractedPage[] },
): Promise<Source> {
  const pages = input.pages;
  if (!pages.length || pages.some((p, i) => p.number !== i + 1))
    throw new RagError("Invalid extracted page sequence.");
  const chapterId = pages[0].chapterId ?? nanoid();
  const files: SourceFile[] = [];
  for (const p of pages) {
    const cid = p.chapterId ?? chapterId;
    const existing = files.find((f) => f.id === cid);
    if (existing) existing.pages++;
    else
      files.push({
        id: cid,
        name: cid,
        hash: input.hash,
        pages: 1,
        offset: p.number - 1,
        title: p.chapterTitle ?? input.title,
      });
  }
  const source = await beginSource(owner, { ...input, files });
  if (source.extractedCount === source.pageCount) return source;
  const token = await claimSource(owner, source.id, "extract");
  await saveExtractionBatch(
    owner,
    source.id,
    token,
    pages.map((p) => ({ ...p, chapterId: p.chapterId ?? chapterId })),
  );
  await finishExtraction(owner, source.id);
  return getSource(owner, source.id);
}
export async function deleteSource(owner: string, id: string): Promise<void> {
  const [d] = await query<{ source_id: string }>(
    "SELECT source_id FROM acharya_rag.documents WHERE id=$1 AND owner=$2",
    [id, owner],
  );
  if (!d) return;
  const sql = sqlClient();
  await sql.transaction([
    sql.query(
      "UPDATE acharya_rag.sources SET deleted_at=now(),active_version=NULL WHERE id=$1 AND owner=$2",
      [d.source_id, owner],
    ),
    sql.query(
      `DELETE FROM acharya_rag.verifications v WHERE owner=$1 AND (paper_id IN (SELECT id FROM acharya_rag.documents WHERE source_id=$2) OR EXISTS(SELECT 1 FROM acharya_rag.documents d WHERE d.source_id=$2 AND v.selections @> jsonb_build_array(jsonb_build_object('documentId',d.id))))`,
      [owner, d.source_id],
    ),
    sql.query(
      `DELETE FROM acharya_rag.generated_papers v WHERE owner=$1 AND EXISTS(SELECT 1 FROM acharya_rag.documents d WHERE d.source_id=$2 AND v.selections @> jsonb_build_array(jsonb_build_object('documentId',d.id)))`,
      [owner, d.source_id],
    ),
    sql.query(
      `DELETE FROM acharya_rag.conversations v WHERE owner=$1 AND EXISTS(SELECT 1 FROM acharya_rag.documents d WHERE d.source_id=$2 AND (v.selections @> jsonb_build_array(jsonb_build_object('documentId',d.id)) OR v.provenance @> jsonb_build_array(jsonb_build_object('documentId',d.id)) OR EXISTS(SELECT 1 FROM acharya_rag.messages m WHERE m.conversation_id=v.id AND m.citations @> jsonb_build_array(jsonb_build_object('documentId',d.id)))))`,
      [owner, d.source_id],
    ),
    sql.query(
      "DELETE FROM acharya_rag.documents WHERE source_id=$1 AND owner=$2",
      [d.source_id, owner],
    ),
  ]);
}
