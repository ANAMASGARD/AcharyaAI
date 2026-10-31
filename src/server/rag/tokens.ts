import { Tiktoken } from "js-tiktoken/lite";
import ranks from "js-tiktoken/ranks/cl100k_base";
const tokenizer = new Tiktoken(ranks);
export const tokenCount = (text: string): number =>
  tokenizer.encode(text, [], []).length;
export function tokenChunks(text: string, limit = 600, overlap = 80): string[] {
  const tokens = tokenizer.encode(text, [], []);
  const result: string[] = [];
  let start = 0;
  while (start < tokens.length) {
    let end = Math.min(tokens.length, start + limit);
    // A Hindi codepoint can occupy several tokens. Never cut inside its UTF-8 sequence.
    while (
      end > start &&
      tokenizer.decode(tokens.slice(start, end)).endsWith("\uFFFD")
    )
      end--;
    if (end === start) throw new Error("Cannot split malformed document text.");
    result.push(tokenizer.decode(tokens.slice(start, end)));
    if (end === tokens.length) break;
    let next = Math.max(start + 1, end - overlap);
    while (
      next < end &&
      tokenizer.decode(tokens.slice(next, end)).startsWith("\uFFFD")
    )
      next++;
    start = next;
  }
  return result;
}
