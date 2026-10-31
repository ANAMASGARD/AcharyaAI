import { expect, it } from "vitest";
import { paperReviewSummary } from "@/lib/paper-review-summary";
import type { Verification, QuestionResult } from "@/types/rag";
const question: QuestionResult = {
  number: "1",
  text: "Question",
  page: 1,
  endPage: 1,
  sharedContext: "",
  extractionCompleteness: "complete",
  answerCorrectness: "not_assessed",
  evidenceSupport: "insufficient",
  marks: null,
  status: "insufficient_evidence",
  explanation: "",
  suggestion: "",
  citations: [],
};
const report: Verification = {
  id: "v",
  paperId: "p",
  status: "completed",
  historical: false,
  extractionNeedsReview: false,
  selections: [],
  error: null,
  totalQuestions: 2,
  questions: [],
};
it("never converts missing evidence or a provisional score into curriculum alignment", () => {
  const summary = paperReviewSummary({
    ...report,
    questions: [
      {
        ...question,
        provisionalReview: {
          clarityScore: 80,
          explanation: "clear",
          suggestion: "",
        },
      },
      question,
    ],
  });
  expect(summary.alignmentScore).toBeNull();
  expect(summary.evidenceCoverage).toBe(0);
  expect(summary.clarityScore).toBe(80);
  expect(summary.needsReview).toBe(2);
});
it("reports coverage separately from alignment of assessed questions", () => {
  const summary = paperReviewSummary({
    ...report,
    questions: [
      { ...question, status: "aligned", evidenceSupport: "supported" },
      question,
    ],
  });
  expect(summary.alignmentScore).toBe(100);
  expect(summary.evidenceCoverage).toBe(50);
  expect(summary.reviewed).toBe(2);
});
it("summarizes explicit title-based estimates without upgrading evidence support", () => {
 const summary=paperReviewSummary({...report,basis:"book_title_estimate",questions:[{...question,status:"aligned"},{...question,status:"partly_aligned"}]});
 expect(summary.alignmentScore).toBe(75);
});
