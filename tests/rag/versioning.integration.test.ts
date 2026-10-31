import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import {
  createSource,
  getSource,
  authorizeSelections,
  deleteSource,
} from "@/server/rag/repository";
import { processSource } from "@/server/rag/documents";
import { query } from "@/server/rag/db";
vi.mock("@/server/rag/openai", () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map(() => [1, ...Array(1535).fill(0)]),
  ),
}));
describe.skipIf(process.env.RAG_INTEGRATION !== "1")(
  "atomic source version publication",
  () => {
    const owner = "version-test-" + Date.now();
    beforeAll(() =>
      Object.assign(process.env, parseEnv(readFileSync(".env", "utf8"))),
    );
    afterAll(async () => {
      await query("DELETE FROM acharya_rag.documents WHERE owner=$1", [owner]);
      await query("DELETE FROM acharya_rag.sources WHERE owner=$1", [owner]);
    });
    it("keeps the current version active until the replacement is fully indexed, then excludes old selections", async () => {
      const base = {
        title: "Versioned notes",
        kind: "reference" as const,
        catalogKey: "versioned-fixture",
        pages: [{ number: 1, text: "Water freezes at zero degrees Celsius." }],
      };
      let old = await createSource(owner, { ...base, hash: "first" });
      old = await processSource(owner, old.id);
      let next = await createSource(owner, {
        ...base,
        hash: "second",
        pages: [
          {
            number: 1,
            text: "Water boils at one hundred degrees Celsius under standard pressure.",
          },
        ],
      });
      expect(next.sourceId).toBe(old.sourceId);
      expect(next.active).toBe(false);
      expect((await getSource(owner, old.id)).active).toBe(true);
      await authorizeSelections(owner, [
        { documentId: old.id, role: "syllabus" },
      ]);
      next = await processSource(owner, next.id);
      expect(next.active).toBe(true);
      expect((await getSource(owner, old.id)).active).toBe(false);
      await expect(
        authorizeSelections(owner, [{ documentId: old.id, role: "syllabus" }]),
      ).rejects.toThrow("historical");
      await deleteSource(owner, next.id);
      await expect(getSource(owner, old.id)).rejects.toThrow("not found");
    }, 30000);
  },
);
