import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createSource, deleteSource } from "@/server/rag/repository";
import { structured, embedTexts } from "@/server/rag/openai";
import { processSource } from "@/server/rag/documents";
import {
  createVerification,
  advanceVerification,
  getVerification,
} from "@/server/rag/verification";
import { query } from "@/server/rag/db";
import { retrieve } from "@/server/rag/retrieve";
import { authorizedReview } from "@/server/rag/review-chat";
import {
  createConversation,
  saveSelections,
  getConversationForTeacher,
} from "@/server/rag/chat";
const calls = vi.hoisted(() => ({ supportQuestions: [] as string[] }));
vi.mock("@/server/rag/openai", () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map(() => [1, ...Array(1535).fill(0)]),
  ),
  structured: vi.fn(
    async (
      name: string,
      _schema: unknown,
      input: { role: string; content: string }[],
    ) => {
      const data = JSON.parse(input.find((m) => m.role === "user")!.content);
      if (name === "question_clarity_review") return { clarityScore: 75, explanation: "Wording estimate only.", suggestion: "Clarify the task." };
      if (name === "paper_questions")
        return {
          coveredPages: data.pages.map((p: { number: number }) => p.number),
          needsReview: false,
          questions: data.pages
            .filter((p: { text: string }) => p.text.includes("Question"))
            .map((p: { number: number; text: string }) => ({
              number: String(p.number),
              text: p.text,
              page: p.number,
              endPage: p.number,
              sharedContext: "",
              extractionCompleteness: "complete",
              marks: null,
            })),
        };
      if (name === "question_alignment")
        return {
          status: data.question.text.includes("quantum")
            ? "outside_scope"
            : "aligned",
          explanation: "Water freezes at zero degrees Celsius.",
          suggestion: "",
          references: [
            {
              passageId: data.evidence[0].chunkId,
              quote: "Water freezes at zero degrees Celsius.",
            },
          ],
        };
      if (name === "evidence_support") {
        const finding = JSON.parse(data.claim);
        calls.supportQuestions.push(finding.question);
        const supported = !finding.question.includes("French Revolution");
        return {
          supported,
          requiresSyllabus: true,
          syllabusSupported: supported,
          contradictory: false,
          reason: supported ? "Supported" : "Unrelated question",
        };
      }
      throw new Error("Unexpected provider operation");
    },
  ),
}));
describe.skipIf(process.env.RAG_INTEGRATION !== "1")(
  "per-question verification",
  () => {
    const owner = "verify-test-" + Date.now();
    beforeAll(() =>
      Object.assign(process.env, parseEnv(readFileSync(".env", "utf8"))),
    );
    afterAll(async () => {
      await query("DELETE FROM acharya_rag.documents WHERE owner=$1", [owner]);
      await query("DELETE FROM acharya_rag.sources WHERE owner=$1", [owner]);
    });
    it("reviews wording without claiming alignment when no books are selected", async () => {
      const paper = await createSource(owner, {title: "General review fixture", kind: "paper", hash: "general-"+owner, pages: [{number:1,text:"Question 1: Explain evaporation."}]});
      let check = await createVerification(owner,paper.id,[]);
      for (let step=0;step<4 && check.status!=="completed";step++) check=await advanceVerification(owner,check.id);
      expect(check.status).toBe("completed");
      expect(check.questions[0].status).toBe("insufficient_evidence");
      expect(check.questions[0].provisionalReview?.clarityScore).toBe(75);
      expect(check.questions[0].citations).toEqual([]);
    }, 60000);
    it("checks final-page questions separately and rejects a true but irrelevant explanation", async () => {
      let ref = await createSource(owner, {
        title: "Syllabus",
        kind: "reference",
        hash: owner,
        pages: [{ number: 1, text: "Water freezes at zero degrees Celsius." }],
      });
      ref = await processSource(owner, ref.id);
      const paper = await createSource(owner, {
        title: "Paper",
        kind: "paper",
        hash: owner + "-paper",
        pages: [
          { number: 1, text: "Question 1: When does water freeze?" },
          { number: 2, text: "Instructions." },
          { number: 3, text: "Read carefully." },
          { number: 4, text: "Additional instructions." },
          { number: 5, text: "Question 5(c): Explain the French Revolution." },
          { number: 6, text: "Question 6: Explain quantum entanglement." },
        ],
      });
      let report = await createVerification(owner, paper.id, [
        { documentId: ref.id, role: "syllabus" },
      ]);
      await expect(
        getVerification(owner + "-other", report.id),
      ).rejects.toThrow("not found");
      await expect(
        advanceVerification(owner + "-other", report.id),
      ).rejects.toThrow("not found");
      for (let i = 0; i < 30 && report.status !== "completed"; i++) {
        vi.mocked(structured).mockClear();
        vi.mocked(embedTexts).mockClear();
        report = await advanceVerification(owner, report.id);
        // Each durable step has room for auth, Neon and one budgeted provider call.
        expect(vi.mocked(structured).mock.calls.length + vi.mocked(embedTexts).mock.calls.length).toBeLessThanOrEqual(1);
      }
      expect(report.status).toBe("completed");
      expect(report.questions).toHaveLength(3);
      expect(report.questions[0].status).toBe("aligned");
      expect(report.questions[1]).toMatchObject({
        page: 5,
        status: "insufficient_evidence",
        marks: null,
        answerCorrectness: "not_assessed",
      });
      expect(calls.supportQuestions).toHaveLength(2);
      const chat = await createConversation(owner);
      await expect(
        authorizedReview(owner + "-other", report.id),
      ).rejects.toThrow("not found");
      await authorizedReview(owner, report.id);
      await saveSelections(
        owner,
        chat.conversationId,
        report.selections,
        report,
      );
      expect(
        (await getConversationForTeacher(owner, chat.conversationId))
          ?.verificationId,
      ).toBe(report.id);
      // Even an agreeing support judge must not establish exclusion from an
      // ordinary positive excerpt. The scope gate prevents that judge call.
      expect(report.questions[2].status).toBe("insufficient_evidence");
      const copy = await createSource(owner, {
        title: "Copy of paper",
        kind: "reference",
        hash: owner + "-copy",
        pages: [
          {
            number: 1,
            text: "Question 1: When does water freeze? Instructions. Read carefully. Additional instructions. Question 5(c): Explain the French Revolution. Question 6: Explain quantum entanglement.",
          },
        ],
      });
      await processSource(owner, copy.id);
      await expect(
        createVerification(owner, paper.id, [
          { documentId: copy.id, role: "syllabus" },
        ]),
      ).rejects.toThrow("identical");
      await deleteSource(owner, ref.id);
      await expect(getVerification(owner, report.id)).rejects.toThrow(
        "not found",
      );
      expect(
        await getConversationForTeacher(owner, chat.conversationId),
      ).toBeNull();
    }, 60000);
    it("excludes a target duplicated inside a multi-chapter source", async () => {
      const text = "Question 1: When does water freeze?";
      let source = await createSource(owner, {
        title: "Collection",
        kind: "reference",
        hash: owner + "collection",
        pages: [
          { number: 1, chapterId: "a".repeat(21), text },
          {
            number: 2,
            chapterId: "b".repeat(21),
            text: "Water freezes at zero degrees Celsius.",
          },
        ],
      });
      source = await processSource(owner, source.id);
      const paper = await createSource(owner, {
        title: "Target",
        kind: "paper",
        hash: owner + "target",
        pages: [{ number: 1, text }],
      });
      const hits = await retrieve(
        owner,
        "When does water freeze?",
        [{ documentId: source.id, role: "syllabus" }],
        undefined,
        paper.id,
      );
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((h) => h.text === text)).toBe(false);
    }, 60000);
  },
);
