export type SourceRole = "syllabus" | "supporting";
export type SourceSelection = {
  documentId: string;
  role: SourceRole;
  chapterIds?: string[];
};
export type Source = {
  id: string;
  sourceId: string;
  versionId: string;
  active: boolean;
  extractedCount: number;
  unresolvedCount: number;
  title: string;
  kind: "reference" | "paper";
  shared: boolean;
  classLevel: string | null;
  subject: string | null;
  status:
    | "extracting"
    | "needs_reupload"
    | "pending"
    | "processing"
    | "ready"
    | "failed";
  error: string | null;
  pageCount: number;
  chunkCount: number;
  embeddedCount: number;
  chapters: { id: string; title: string }[];
  createdAt: string;
};
export type Citation = {
  chunkId: string;
  documentId: string;
  title: string;
  chapterTitle: string | null;
  page: number;
  text: string;
  role: SourceRole;
};
export type QuestionResult = {
  provisionalReview?: {
    clarityScore: number;
    explanation: string;
    suggestion: string;
  };
  number: string;
  text: string;
  page: number;
  endPage: number;
  sharedContext: string;
  extractionCompleteness: "complete" | "needs_review";
  answerCorrectness: "not_assessed";
  evidenceSupport: "supported" | "insufficient";
  marks: number | null;
  status:
    | "aligned"
    | "partly_aligned"
    | "outside_scope"
    | "insufficient_evidence"
    | "needs_review";
  explanation: string;
  suggestion: string;
  citations: Citation[];
};
export type Verification = {
  basis?: "book_title_estimate";
  id: string;
  paperId: string;
  status: "pending" | "processing" | "completed" | "failed";
  historical: boolean;
  extractionNeedsReview: boolean;
  selections: SourceSelection[];
  error: string | null;
  totalQuestions: number;
  questions: QuestionResult[];
};
