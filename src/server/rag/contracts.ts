import { z } from "zod";
import { tokenChunks } from "./tokens";
import type { Citation, SourceSelection } from "../../types/rag";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_PAGES = 100;
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const EXTRACTION_VERSION = "page-outcomes-v3-single-review";
export const CHUNKING_VERSION = "cl100k_base:600:80:v2";
export const EMBEDDING_PROFILE = "openai:text-embedding-3-small:1536:page-v2";
export const selectionSchema = z
  .array(
    z.object({
      documentId: z.string().min(1).max(100),
      role: z.enum(["syllabus", "supporting"]),
      chapterIds: z.array(z.string().min(1).max(100)).max(200).optional(),
    }),
  )
  .max(30);
export type ExtractedPage = {
  number: number;
  sourcePage?: number;
  text: string;
  chapterId?: string;
  chapterTitle?: string;
  method?: "text" | "vision";
  outcome?: "extracted" | "blank" | "unresolved";
  printedLabel?: string;
};
export class RagError extends Error {
  constructor(
    message: string,
    public status = 400,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export function validateSelections(
  value: unknown,
  paperId?: string,
  requireSyllabus = false,
): SourceSelection[] {
  const selections = selectionSchema.parse(value);
  if (new Set(selections.map((s) => s.documentId)).size !== selections.length)
    throw new RagError("Select each source only once.");
  if (paperId && selections.some((s) => s.documentId === paperId))
    throw new RagError("A question paper cannot be its own reference.");
  if (requireSyllabus && !selections.some((s) => s.role === "syllabus"))
    throw new RagError("Select at least one syllabus source.");
  return selections;
}
export function makeChunks(
  pages: ExtractedPage[],
): {
  page: number;
  sourcePage: number;
  text: string;
  index: number;
  chapterId: string | null;
  chapterTitle: string | null;
}[] {
  const chunks: ReturnType<typeof makeChunks> = [];
  for (const page of pages) {
    const text = page.text.replace(/\s+/gu, " ").trim();
    for (const passage of tokenChunks(text)) {
      chunks.push({
        page: page.number,
        sourcePage: page.sourcePage ?? page.number,
        text: passage,
        index: chunks.length,
        chapterId: page.chapterId ?? null,
        chapterTitle: page.chapterTitle ?? null,
      });
    }
  }
  return chunks;
}
export function validateCitations(
  ids: string[],
  evidence: Citation[],
  requireSyllabus = false,
): Citation[] {
  const found = [...new Set(ids)].map((id) => {
    const citation = evidence.find((c) => c.chunkId === id);
    if (!citation)
      throw new RagError("The model returned an unverified citation.", 502);
    return citation;
  });
  if (requireSyllabus && !found.some((c) => c.role === "syllabus"))
    throw new RagError(
      "The verdict needs evidence from a selected syllabus source.",
      502,
    );
  return found;
}
