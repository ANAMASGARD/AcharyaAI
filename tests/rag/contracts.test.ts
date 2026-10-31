import { describe, expect, it } from "vitest";
import {
  makeChunks,
  validateSelections,
  validateCitations,
} from "@/server/rag/contracts";

describe("RAG evidence contracts", () => {
  it("keeps page identity and excludes empty pages when splitting passages", () => {
    const chunks = makeChunks([
      {
        number: 1,
        text: "अध्याय विज्ञान",
        chapterId: "chapter-a",
        chapterTitle: "Science",
      },
      { number: 2, text: "" },
      { number: 3, text: "x".repeat(4200) },
    ]);
    expect(chunks.map((c) => c.page)).toEqual([1, 3]);
    expect(chunks[0].chapterId).toBe("chapter-a");
    expect(chunks[1].text.length).toBe(4200);
  });
  it("requires a syllabus and rejects the paper as its own evidence", () => {
    expect(() =>
      validateSelections(
        [{ documentId: "paper", role: "syllabus" }],
        "paper",
        true,
      ),
    ).toThrow();
    expect(() =>
      validateSelections(
        [{ documentId: "book", role: "supporting" }],
        "paper",
        true,
      ),
    ).toThrow();
    expect(
      validateSelections(
        [{ documentId: "book", role: "syllabus" }],
        "paper",
        true,
      ),
    ).toHaveLength(1);
  });
  it("rejects fabricated or non-syllabus evidence for an alignment verdict", () => {
    const evidence = [
      {
        chunkId: "valid",
        documentId: "book",
        title: "Book",
        chapterTitle: null,
        page: 4,
        text: "Water freezes.",
        role: "syllabus" as const,
      },
    ];
    expect(() => validateCitations(["invented"], evidence, true)).toThrow();
    expect(validateCitations(["valid"], evidence, true)[0].page).toBe(4);
    expect(() =>
      validateCitations(
        ["valid"],
        [{ ...evidence[0], role: "supporting" }],
        true,
      ),
    ).toThrow();
  });
});
