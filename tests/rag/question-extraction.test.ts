import { it, expect } from "vitest";
import { mergeQuestions } from "@/server/rag/verification";
const first = {
  number: "A.1(a)",
  text: "Explain the shared passage.",
  page: 2,
  endPage: 3,
  sharedContext: "A story begins on page 2.",
  extractionCompleteness: "complete" as const,
  marks: null,
};
it("keeps final-page subparts and unknown marks; flags conflicting continuations for review", () => {
  const last = {
    ...first,
    number: "B.9(c)",
    text: "Final subquestion",
    page: 10,
    endPage: 10,
  };
  const all = mergeQuestions(
    [first],
    [
      { ...first, text: "Explain the shared passage and its continuation." },
      last,
    ],
  );
  expect(all).toHaveLength(2);
  expect(all[0].extractionCompleteness).toBe("needs_review");
  expect(all[1].page).toBe(10);
  expect(all[1].marks).toBeNull();
});
