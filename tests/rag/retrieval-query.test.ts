import { it, expect, vi } from "vitest";
import { retrievalQueries } from "@/server/rag/retrieve";
import { structured } from "@/server/rag/openai";
vi.mock("@/server/rag/openai", () => ({
  structured: vi.fn(),
  embedTexts: vi.fn(),
}));
it("keeps the Hindi query and adds a translation without inventing an answer", async () => {
  const original = "साइकिल का रंग क्या है?";
  vi.mocked(structured).mockResolvedValue({
    english: "What colour is the bicycle?",
  });
  expect(await retrievalQueries(original)).toEqual([
    original,
    "What colour is the bicycle?",
  ]);
  const calls = vi.mocked(structured).mock.calls;
  expect(calls[0][0]).toBe("retrieval_translation");
  vi.mocked(structured).mockClear();
  expect(await retrievalQueries("What colour is the bicycle?")).toEqual([
    "What colour is the bicycle?",
  ]);
  expect(structured).not.toHaveBeenCalled();
});
