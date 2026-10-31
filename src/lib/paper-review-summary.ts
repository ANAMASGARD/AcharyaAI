import type { Verification } from "@/types/rag";
/** Scores are question-count estimates, never invented marks or official weightage. */
export function paperReviewSummary(report: Verification) {
  const questions = report.questions;
  const supported = questions.filter(
    (q) =>
      (report.basis === "book_title_estimate" || q.evidenceSupport === "supported") &&
      ["aligned", "partly_aligned", "outside_scope"].includes(q.status),
  );
  const provisional = questions.flatMap((q) =>
    q.provisionalReview ? [q.provisionalReview.clarityScore] : [],
  );
  return {
    total: report.totalQuestions,
    reviewed: questions.length,
    aligned: supported.filter((q) => q.status === "aligned").length,
    partial: supported.filter((q) => q.status === "partly_aligned").length,
    outside: supported.filter((q) => q.status === "outside_scope").length,
    needsReview: questions.length - supported.length,
    evidenceCoverage: report.totalQuestions
      ? Math.round((supported.length / report.totalQuestions) * 100)
      : 0,
    alignmentScore: supported.length
      ? Math.round(
          (supported.reduce(
            (n, q) =>
              n +
              (q.status === "aligned"
                ? 1
                : q.status === "partly_aligned"
                  ? 0.5
                  : 0),
            0,
          ) /
            supported.length) *
            100,
        )
      : null,
    clarityScore: provisional.length
      ? Math.round(provisional.reduce((a, b) => a + b, 0) / provisional.length)
      : null,
    chapters: [
      ...new Set(
        supported.flatMap((q) =>
          q.citations
            .filter((c) => c.role === "syllabus")
            .map((c) => `${c.title} · ${c.chapterTitle ?? "Book"}`),
        ),
      ),
    ],
  };
}
