import { it, expect } from "vitest";
import { getEncoding } from "js-tiktoken";
import { makeChunks } from "@/server/rag/contracts";
it("bounds multilingual chunks by tokens without losing page identity or corrupting Unicode", () => {
  const text = "यह विज्ञान का अध्याय है। ".repeat(400);
  const chunks = makeChunks([{ number: 7, text, sourcePage: 2 }]);
  const tokenizer = getEncoding("cl100k_base");
  expect(chunks.length).toBeGreaterThan(3);
  for (const c of chunks) {
    expect(tokenizer.encode(c.text).length).toBeLessThanOrEqual(600);
    expect(c.page).toBe(7);
    expect(c.sourcePage).toBe(2);
    expect(c.text).not.toContain("\uFFFD");
  }
});
