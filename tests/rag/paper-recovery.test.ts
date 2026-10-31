import { expect, it, vi } from "vitest";
import { processSource } from "@/server/rag/documents";
import {
  getSource,
  finishExtraction,
  claimSource,
} from "@/server/rag/repository";
import { embedTexts } from "@/server/rag/openai";
import type { Source } from "@/types/rag";
vi.mock("@/server/rag/repository", () => ({
  getSource: vi.fn(),
  finishExtraction: vi.fn(),
  claimSource: vi.fn(),
  failSource: vi.fn(),
}));
vi.mock("@/server/rag/openai", () => ({ embedTexts: vi.fn() }));
vi.mock("@/server/rag/db", () => ({ query: vi.fn(), sqlClient: vi.fn() }));
it("resumes a fully extracted paper without embedding it or claiming an embedding lease", async () => {
  const saved = {
    id: "paper",
    kind: "paper",
    status: "needs_reupload",
    pageCount: 1,
    extractedCount: 1,
    chunkCount: 0,
    unresolvedCount: 0,
  } as Source;
  const ready = { ...saved, status: "ready", chunkCount: 1 } as Source;
  vi.mocked(getSource)
    .mockResolvedValueOnce(saved)
    .mockResolvedValueOnce(ready);
  expect(await processSource("owner", "paper")).toEqual(ready);
  expect(finishExtraction).toHaveBeenCalledWith("owner", "paper");
  expect(claimSource).not.toHaveBeenCalled();
  expect(embedTexts).not.toHaveBeenCalled();
});
