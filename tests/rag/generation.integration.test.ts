import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { POST, GET } from "@/app/api/notes/generate+api";
import { createSource, deleteSource } from "@/server/rag/repository";
import { processSource } from "@/server/rag/documents";
import { query } from "@/server/rag/db";
const state = vi.hoisted(() => ({ invalid: false }));
vi.mock("@/lib/api-auth", () => ({
  ApiAuthError: class extends Error {},
  requireAuth: vi.fn(async (r: Request) => ({
    userId: r.headers.get("Authorization"),
  })),
}));
vi.mock("@/server/rag/openai", () => ({
  embedTexts: vi.fn(async (t: string[]) =>
    t.map(() => [1, ...Array(1535).fill(0)]),
  ),
  structured: vi.fn(
    async (
      _n: unknown,
      _s: unknown,
      input: { role: string; content: string }[],
    ) => {
      const evidence = JSON.parse(
        input.find((i) => i.role === "user")!.content,
      ).evidence;
      return {
        title: "Draft water paper",
        sections: [
          {
            title: "Short answers",
            questions: [
              {
                number: 1,
                text: "At what temperature does water freeze?",
                marks: 2,
                difficulty: "easy",
                references: [
                  {
                    passageId: state.invalid
                      ? "fabricated"
                      : evidence[0].chunkId,
                    quote: "Water freezes at zero degrees Celsius.",
                  },
                ],
              },
            ],
          },
        ],
      };
    },
  ),
}));
describe.skipIf(process.env.RAG_INTEGRATION !== "1")(
  "Neon paper generation route",
  () => {
    const owner = "generation-test-" + Date.now();
    beforeAll(() =>
      Object.assign(process.env, parseEnv(readFileSync(".env", "utf8"))),
    );
    afterAll(async () => {
      await query("DELETE FROM acharya_rag.generated_papers WHERE owner=$1", [
        owner,
      ]);
      await query("DELETE FROM acharya_rag.documents WHERE owner=$1", [owner]);
      await query("DELETE FROM acharya_rag.sources WHERE owner=$1", [owner]);
    });
    it("generates and saves a cited draft, scopes history, rejects fabricated references, and removes dependent content", async () => {
      let source = await createSource(owner, {
        title: "Water",
        kind: "reference",
        classLevel: "class-6",
        subject: "science",
        hash: owner,
        pages: [{ number: 1, text: "Water freezes at zero degrees Celsius." }],
      });
      source = await processSource(owner, source.id);
      const request = (who = owner) =>
        new Request("https://test/api/notes/generate", {
          method: "POST",
          headers: { Authorization: who, "Content-Type": "application/json" },
          body: JSON.stringify({
            classId: "class-6",
            subjectId: "science",
            bookIds: [source.id],
          }),
        });
      const response = await POST(request());
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.paper.totalMarks).toBe(2);
      expect(
        result.paper.sections[0].questions[0].citations[0].documentId,
      ).toBe(source.id);
      const saved = (who: string) =>
        new Request(
          "https://test/api/notes/generate?id=" + result.verificationId,
          { headers: { Authorization: who } },
        );
      expect((await GET(saved(owner))).status).toBe(200);
      expect((await GET(saved(owner + "-other"))).status).toBe(404);
      expect((await POST(request(owner + "-other"))).status).toBe(400);
      state.invalid = true;
      expect((await POST(request())).status).toBe(502);
      await deleteSource(owner, source.id);
      expect((await GET(saved(owner))).status).toBe(404);
    }, 60000);
  },
);
