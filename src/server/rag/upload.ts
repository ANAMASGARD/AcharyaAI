import { nanoid } from "nanoid";
import { query } from "./db";
import { RagError } from "./contracts";
import { extractPageBatch, inspectFile } from "./extraction";
import {
  beginSource,
  claimSource,
  digest,
  failSource,
  getSource,
  saveExtractionBatch,
  type SourceFile,
} from "./repository";
import type { Source } from "../../types/rag";
export async function startUpload(
  owner: string,
  bytes: Uint8Array,
  mime: string,
  input: {
    uploadAttempt?: string;
    title: string;
    kind: Source["kind"];
    classLevel?: string;
    subject?: string;
  },
): Promise<Source> {
  const count = await inspectFile(bytes, mime);
  const hash = digest(bytes);
  return beginSource(owner, {
    ...input,
    hash,
    files: [
      {
        id: nanoid(),
        name: input.title,
        title: input.title,
        hash,
        pages: count,
        offset: 0,
      },
    ],
  });
}
export async function extractSourceStep(
  owner: string | null,
  id: string,
  bytes: Uint8Array,
  mime: string,
  options: {
    fileId?: string;
    signal?: AbortSignal;
    forceVision?: boolean;
    maxPages?: number;
  } = {},
): Promise<Source> {
  const maxPages = options.maxPages ?? 3;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 3)
    throw new RagError(
      "Extraction batches must contain one to three pages.",
      400,
    );
  const current = await getSource(owner, id);
  if (current.status === "ready" || current.status === "pending")
    return current;
  const [d] = await query<{ files: SourceFile[]; attempts: number }>(
    `SELECT files,attempts FROM acharya_rag.documents WHERE id=$1 AND owner IS NOT DISTINCT FROM $2`,
    [id, owner],
  );
  const file = d?.files.find((f) =>
    options.fileId ? f.id === options.fileId : true,
  );
  if (!file || digest(bytes) !== file.hash)
    throw new RagError(
      "Select the same file to resume: its content hash must match.",
      409,
    );
  const saved = await query<{ number: number; outcome: string }>(
    "SELECT number,outcome FROM acharya_rag.pages WHERE document_id=$1 AND chapter_id=$2 ORDER BY number",
    [id, file.id],
  );
  const numbers = Array.from({ length: file.pages }, (_, i) => i + 1)
    .filter(
      (n) =>
        !saved.some(
          (p) => p.number === n + file.offset && p.outcome !== "unresolved",
        ),
    )
    .slice(0, d.attempts > 0 ? 1 : maxPages);
  // Return the durable extraction checkpoint. Chunking/publication happens
  // in the next PATCH, so its failure cannot hide a successful upload ID.
  if (!numbers.length) return getSource(owner, id);
  const token = await claimSource(owner, id, "extract");
  try {
    const pages = await extractPageBatch(bytes, mime, numbers, options);
    await saveExtractionBatch(
      owner,
      id,
      token,
      pages.map((p) => ({
        ...p,
        number: p.number + file.offset,
        sourcePage: p.number,
        chapterId: file.id,
        chapterTitle: file.title,
      })),
    );
    if (pages.some((p) => p.outcome === "unresolved"))
      throw new RagError(
        "Some pages remain unreadable. This source cannot be published.",
        422,
      );
  } catch (error) {
    await failSource(id, token, error, true);
    throw error;
  }
  return getSource(owner, id);
}
