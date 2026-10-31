import { beforeEach, expect, it, vi } from "vitest";
import { retrieve } from "@/server/rag/retrieve";
import { embedTexts } from "@/server/rag/openai";
import { query } from "@/server/rag/db";
import { authorizeSelections } from "@/server/rag/repository";
import { RagError } from "@/server/rag/contracts";
vi.mock("@/server/rag/openai", () => ({
  embedTexts: vi.fn(),
  structured: vi.fn(),
}));
vi.mock("@/server/rag/db", () => ({ query: vi.fn() }));
vi.mock("@/server/rag/repository", () => ({ authorizeSelections: vi.fn() }));
const scope = [
  { documentId: "book", role: "syllabus" as const, chapterIds: ["chapter"] },
];
beforeEach(() => vi.resetAllMocks());
it("uses authorized lexical passages if query embeddings are unavailable", async () => {
  vi.mocked(embedTexts).mockRejectedValue(
    new RagError("Provider unavailable", 503),
  );
  vi.mocked(query).mockResolvedValue([
    {
      id: "passage",
      document_id: "book",
      title: "Book",
      role: "syllabus",
      chapter_title: "Chapter",
      page: 7,
      text: "Water cycle evaporation",
    },
  ]);
  const result = await retrieve(
    "teacher",
    "Explain water cycle evaporation",
    scope,
  );
  expect(result[0].chunkId).toBe("passage");
  expect(authorizeSelections).toHaveBeenCalledWith("teacher", scope);
  const [sql, params] = vi.mocked(query).mock.calls[0];
  expect(sql).toContain("logical.active_version=d.id");
  expect(sql).toContain("d.owner=$2 OR d.owner IS NULL");
  expect(sql).toContain("chapterIds");
  expect(sql).toContain("textHash");
  expect(sql).toContain("ts_rank");
  expect(params?.[0]).toBe(JSON.stringify(scope));
});
it("does not bypass a budget rejection or cancellation", async () => {
  vi.mocked(embedTexts).mockRejectedValue(new RagError("Budget limit", 402));
  await expect(retrieve("teacher", "Water", scope)).rejects.toMatchObject({
    status: 402,
  });
  expect(query).not.toHaveBeenCalled();
});
it("authorization failures never enter fallback retrieval", async () => {
  vi.mocked(authorizeSelections).mockRejectedValue(
    new RagError("Forbidden", 403),
  );
  await expect(retrieve("other", "Water", scope)).rejects.toMatchObject({
    status: 403,
  });
  expect(query).not.toHaveBeenCalled();
  expect(embedTexts).not.toHaveBeenCalled();
});
