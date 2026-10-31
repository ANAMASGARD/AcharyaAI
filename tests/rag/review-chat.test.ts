import { expect, it, vi } from "vitest";
import { discussReview } from "@/server/rag/review-chat";
import { structured } from "@/server/rag/openai";
import type { Verification } from "@/types/rag";
vi.mock("@/server/rag/openai", () => ({ structured: vi.fn() }));
const review: Verification = {
  id: "r".repeat(21),
  paperId: "p".repeat(21),
  status: "completed",
  historical: false,
  extractionNeedsReview: false,
  selections: [],
  error: null,
  totalQuestions: 1,
  questions: [
    {
      number: "2",
      text: "Explain quantum entanglement.",
      page: 5,
      endPage: 5,
      sharedContext: "",
      extractionCompleteness: "complete",
      answerCorrectness: "not_assessed",
      evidenceSupport: "insufficient",
      marks: null,
      status: "insufficient_evidence",
      explanation: "The selected book passages do not establish alignment.",
      suggestion: "Review the intended syllabus.",
      citations: [],
    },
  ],
};
it("discusses saved findings without turning missing evidence into mismatch", async () => {
  vi.mocked(structured).mockResolvedValue({ focus: "concerns", indexes: [] });
  const units: string[] = [];
  const result = await discussReview(
    "Which questions are out of context?",
    review,
    async (t) => {
      units.push(t);
    },
  );
  expect(result.content).toContain("Question 2");
  expect(result.content).toContain(
    "Insufficient evidence — not an established mismatch",
  );
  expect(result.content).not.toContain("Outside syllabus — supported finding");
  expect(result.content).toContain("Answer correctness was not assessed");
  expect(units.join("")).toBe(result.content);
  vi.mocked(structured).mockResolvedValue({ focus: "specific", indexes: [99] });
  await expect(
    discussReview("question 99", review, async () => {}),
  ).rejects.toThrow("unknown question");
});
