import { describe, it, expect, vi, afterEach } from "vitest";
import { embedTexts, structured, openAI } from "@/server/rag/openai";
import { z } from "zod";
vi.mock("@/server/rag/budget", () => ({
  reserveUsage: vi.fn(async () => "reservation"),
  settleUsage: vi.fn(async () => undefined),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("OpenAI boundary", () => {
  it("does not make unreserved SDK retries and preserves Retry-After", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    const call = vi.fn(async () =>
      Response.json(
        { error: { message: "provider internal content" } },
        { status: 429, headers: { "retry-after": "7" } },
      ),
    );
    vi.stubGlobal("fetch", call);
    await expect(
      openAI("responses", { model: "gpt-5-mini" }),
    ).rejects.toMatchObject({ status: 429, retryAfter: 7 });
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("matches embeddings to input indexes rather than provider order", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            { index: 1, embedding: Array(1536).fill(2) },
            { index: 0, embedding: Array(1536).fill(1) },
          ],
        }),
      ),
    );
    expect((await embedTexts(["first", "second"])).map((v) => v[0])).toEqual([
      1, 2,
    ]);
  });
  it("rejects incompatible dimensions", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ data: [{ index: 0, embedding: [1, 2] }] }),
        ),
    );
    await expect(embedTexts(["first"])).rejects.toThrow();
  });
  it("rejects incomplete structured responses even if output looks usable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ status: "incomplete", output: [] })),
    );
    await expect(
      structured("test", z.object({ text: z.string() }), []),
    ).rejects.toThrow("incomplete");
  });
});
