import { it, expect, vi } from "vitest";
import {
  resolveReferences,
  assessSupport,
  hasExplicitScopeBoundary,
} from "@/server/rag/grounding";
import { structured } from "@/server/rag/openai";
vi.mock("@/server/rag/openai", () => ({ structured: vi.fn() }));
const evidence = [
  {
    chunkId: "water",
    documentId: "book",
    title: "Science",
    chapterTitle: "States of matter",
    page: 7,
    text: "Water freezes at zero degrees Celsius.",
    role: "syllabus" as const,
  },
];
it("requires explicit syllabus restrictions before an outside-scope finding", () => {
  const citation = (
    text: string,
    role: "syllabus" | "supporting" = "syllabus",
  ) => [{ ...evidence[0], text, role }];
  expect(
    hasExplicitScopeBoundary(
      citation("I have a red bicycle. I only ride it in the park."),
    ),
  ).toBe(false);
  expect(
    hasExplicitScopeBoundary(
      citation("This curriculum includes poems about bicycles."),
    ),
  ).toBe(false);
  expect(
    hasExplicitScopeBoundary(
      citation("The assessment is limited to chapters 1 and 2."),
    ),
  ).toBe(true);
  expect(
    hasExplicitScopeBoundary(
      citation("The assessment is limited to chapters 1 and 2.", "supporting"),
    ),
  ).toBe(false);
  expect(
    hasExplicitScopeBoundary(
      citation("पाठ्यक्रम केवल पहले दो अध्यायों तक सीमित है।"),
    ),
  ).toBe(true);
});
it("rejects invented IDs and quotations while resolving metadata server-side", () => {
  expect(() =>
    resolveReferences([{ passageId: "invented", quote: "Water" }], evidence),
  ).toThrow();
  expect(() =>
    resolveReferences(
      [{ passageId: "water", quote: "Water freezes at ten degrees." }],
      evidence,
    ),
  ).toThrow();
  expect(
    resolveReferences(
      [{ passageId: "water", quote: "zero degrees Celsius" }],
      evidence,
      true,
    )[0].page,
  ).toBe(7);
});
it("does not accept a real but irrelevant passage as support", async () => {
  vi.mocked(structured).mockResolvedValue({
    supported: false,
    syllabusSupported: false,
    contradictory: false,
    reason: "Water does not support arithmetic.",
  });
  expect(await assessSupport("7 times 7 is 42", evidence)).toBe(false);
});
