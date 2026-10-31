import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { startUpload, extractSourceStep } from "@/server/rag/upload";
import {
  getSource,
  finishExtraction,
  deleteSource,
  claimSource,
  saveExtractionBatch,
  beginSource,
  digest,
} from "@/server/rag/repository";
import { query } from "@/server/rag/db";
vi.mock("@/server/rag/openai", () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map(() => [1, ...Array(1535).fill(0)]),
  ),
  structured: vi.fn(),
}));
describe.skipIf(process.env.RAG_INTEGRATION !== "1")(
  "durable extraction and deletion",
  () => {
    const owner = "recovery-" + Date.now();
    let bytes: Uint8Array;
    beforeAll(async () => {
      Object.assign(process.env, parseEnv(readFileSync(".env", "utf8")));
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      for (let i = 0; i < 5; i++)
        pdf
          .addPage()
          .drawText(
            `Page ${i + 1}: Water is part of the curriculum. This is a searchable document with five pages.`,
            { font, size: 10 },
          );
      bytes = await pdf.save();
    });
    afterAll(async () => {
      await query("DELETE FROM acharya_rag.documents WHERE owner=$1", [owner]);
      await query("DELETE FROM acharya_rag.sources WHERE owner=$1", [owner]);
    });
    it("checkpoints three pages, requires matching bytes, resumes, publishes, and fences deletion", async () => {
      let s = await startUpload(owner, bytes, "application/pdf", {
        title: "Recovery fixture",
        kind: "reference",
      });
      expect(s.extractedCount).toBe(0);
      expect(s.status).toBe("needs_reupload");
      s = await extractSourceStep(owner, s.id, bytes, "application/pdf");
      expect(s.extractedCount).toBe(3);
      expect(s.active).toBe(false);
      await expect(
        extractSourceStep(
          owner,
          s.id,
          new Uint8Array([1, 2]),
          "application/pdf",
        ),
      ).rejects.toThrow("hash");
      await expect(
        extractSourceStep(owner, s.id, bytes, "application/pdf", {
          maxPages: 4,
        }),
      ).rejects.toThrow("one to three");
      s = await extractSourceStep(owner, s.id, bytes, "application/pdf", {
        maxPages: 1,
      });
      expect(s.extractedCount).toBe(4);
      s = await extractSourceStep(owner, s.id, bytes, "application/pdf", {
        maxPages: 1,
      });
      expect(s.extractedCount).toBe(5);
      expect(s.status).toBe("needs_reupload");
      await finishExtraction(owner,s.id);
      s=await getSource(owner,s.id);
      expect(s.status).toBe("pending");
      const token = await claimSource(owner, s.id, "embed");
      await deleteSource(owner, s.id);
      await saveExtractionBatch(owner, s.id, token, [
        { number: 1, text: "stale write" },
      ]);
      await expect(getSource(owner, s.id)).rejects.toThrow("not found");
      await expect(
        startUpload(owner, bytes, "application/pdf", {
          title: "Recovery fixture",
          kind: "reference",
        }),
      ).rejects.toThrow("deleted");
      expect(
        await query("SELECT id FROM acharya_rag.pages WHERE document_id=$1", [
          s.id,
        ]),
      ).toHaveLength(0);
    }, 60000);
    it("hides shared staged sources even from guessed IDs", async () => {
      const key = "test-" + Date.now();
      const s = await beginSource(null, {
        title: key,
        kind: "reference",
        hash: digest(key),
        catalogKey: key,
        files: [
          {
            id: "a".repeat(21),
            hash: digest(key),
            name: "chapter.pdf",
            title: "Chapter",
            pages: 1,
            offset: 0,
          },
        ],
      });
      try {
        await expect(getSource(owner, s.id)).rejects.toThrow("not found");
      } finally {
        await query("DELETE FROM acharya_rag.documents WHERE id=$1", [s.id]);
        await query("DELETE FROM acharya_rag.sources WHERE id=$1", [
          s.sourceId,
        ]);
      }
    });
  },
);
