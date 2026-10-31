export const EMBEDDING_CONTRACT = 'eg2-text270m-int4-2d079ee2-litert018-cpu-f32-prefix1-mrl256-l2-chunk1';
export const EMBEDDING_DIMENSIONS = 256;
export type SourceChunk = { kind: 'notes' | 'reflection'; chunkIndex: number; title: string; content: string };
/** Bound Unicode codepoints conservatively below the native tokenizer's 2048-token limit. */
export function reportSourceChunks(title: string, notes: string, reflection: string): SourceChunk[] {
  const result: SourceChunk[] = [];
  for (const [kind, text] of [['notes', notes], ['reflection', reflection]] as const) {
    const points = Array.from(text.trim());
    for (let offset = 0, chunkIndex = 0; offset < points.length; offset += 320, chunkIndex++) {
      result.push({ kind, chunkIndex, title: Array.from(title).slice(0, 80).join(''), content: points.slice(offset, offset + 400).join('') });
      if (offset + 400 >= points.length) break;
    }
  }
  return result;
}
