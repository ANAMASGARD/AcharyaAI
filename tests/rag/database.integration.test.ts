import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import {
  createSource,
  getSource,
  listSources,
  authorizeSelections,
  deleteSource,
} from "@/server/rag/repository";
import { processSource } from "@/server/rag/documents";
import { retrieve } from "@/server/rag/retrieve";
import { query } from "@/server/rag/db";
import {
  createConversation,
  appendMessage,
  listMessages,
  deleteConversationForTeacher,
} from "@/server/rag/chat";
import { createVerification } from "@/server/rag/verification";
const provider = vi.hoisted(() => ({ fail: false }));
vi.mock("@/server/rag/openai", () => ({
  embedTexts: vi.fn(async (texts: string[]) => {
    if (provider.fail) throw new Error("simulated provider outage");
    return texts.map(() => [1, ...Array(1535).fill(0)]);
  }),
}));
const run = process.env.RAG_INTEGRATION === "1";
describe.skipIf(!run)("Neon persistence and ownership", () => {
  const owner = `rag-test-${Date.now()}`;
  const other = owner + "-other";
  const ids: string[] = [];
  beforeAll(() => {
    const env = parseEnv(readFileSync(".env", "utf8"));
    process.env.DATABASE_URL = env.DATABASE_URL;
  });
  afterAll(async () => {
    await query(
      "DELETE FROM acharya_rag.conversations WHERE owner=ANY($1::text[])",
      [[owner, other]],
    );
    await query("DELETE FROM acharya_rag.documents WHERE id=ANY($1::text[])", [
      ids,
    ]);
    await query("DELETE FROM acharya_rag.sources WHERE owner=ANY($1::text[])", [
      [owner, other],
    ]);
  });
  it("creates atomic pages, deduplicates, resumes indexing, scopes retrieval and removes private evidence", async () => {
    const input = {
      title: "Integration fixture",
      kind: "reference" as const,
      pages: [
        {
          number: 1,
          sourcePage: 7,
          chapterId: "c".repeat(21),
          chapterTitle: "Water",
          text: "Water freezes. ".repeat(4000),
        },
      ],
      hash: owner,
    };
    const a = await createSource(owner, input);
    ids.push(a.id);
    expect(a.id).toHaveLength(21);
    expect(a.pageCount).toBe(1);
    expect(a.chunkCount).toBeGreaterThan(16);
    expect((await createSource(owner, input)).id).toBe(a.id);
    await expect(getSource(other, a.id)).rejects.toThrow("not found");
    expect((await listSources(other)).some((s) => s.id === a.id)).toBe(false);
    await expect(
      authorizeSelections(owner, [{ documentId: a.id, role: "syllabus" }]),
    ).rejects.toThrow("processing");
    provider.fail = true;
    await expect(processSource(owner, a.id)).rejects.toThrow("outage");
    provider.fail = false;
    await query(
      "UPDATE acharya_rag.documents SET next_attempt_at=NULL WHERE id=$1",
      [a.id],
    );
    expect((await getSource(owner, a.id)).status).toBe("failed");
    let state = await processSource(owner, a.id);
    expect(state.status).toBe("pending");
    expect(state.embeddedCount).toBe(16);
    while (state.status !== "ready") state = await processSource(owner, a.id);
    const evidence = await retrieve(owner, "water", [
      { documentId: a.id, role: "syllabus", chapterIds: ["c".repeat(21)] },
    ]);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every((c) => c.documentId === a.id && c.page === 7)).toBe(
      true,
    );
    await expect(
      retrieve(other, "water", [{ documentId: a.id, role: "syllabus" }]),
    ).rejects.toThrow();
    await expect(
      retrieve(owner, "water", [
        { documentId: a.id, role: "syllabus", chapterIds: ["invalid"] },
      ]),
    ).rejects.toThrow("chapter");
    const paper = await createSource(owner, {
      ...input,
      kind: "paper",
      hash: owner + "paper",
      pages: [
        {
          number: 1,
          text: "Question 1. At what temperature does water freeze?",
        },
      ],
    });
    ids.push(paper.id);
    await expect(
      createVerification(owner, paper.id, [
        { documentId: paper.id, role: "syllabus" },
      ]),
    ).rejects.toThrow("own reference");
    const report = await createVerification(owner, paper.id, [
      { documentId: a.id, role: "syllabus" },
    ]);
    expect(report.status).toBe("pending");
    const chat = await createConversation(owner);
    await appendMessage(
      owner,
      chat.conversationId,
      "assistant",
      "Grounded answer",
      evidence,
    );
    expect(await listMessages(other, chat.conversationId)).toHaveLength(0);
    expect(await deleteConversationForTeacher(other, chat.conversationId)).toBe(
      false,
    );
    await deleteSource(other, a.id);
    expect((await getSource(owner, a.id)).status).toBe("ready");
    await deleteSource(owner, a.id);
    await expect(getSource(owner, a.id)).rejects.toThrow();
    expect(await listMessages(owner, chat.conversationId)).toHaveLength(0);
    expect(
      await query("SELECT id FROM acharya_rag.verifications WHERE id=$1", [
        report.id,
      ]),
    ).toHaveLength(0);
  }, 120000);
});
