import { EMBEDDING_CONTRACT, EMBEDDING_DIMENSIONS } from './contract';
export type VectorChunk = { id: string; kind: 'notes' | 'reflection'; chunkIndex: number; title: string; content: string; contract: string; vector: number[] };
export type VectorBatch = { reportId: string; chunks: VectorChunk[] };
export function validateVectorBatch(value: unknown): VectorBatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid vector batch');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 2 || typeof row.reportId !== 'string' || !/^[A-Za-z0-9_-]{21}$/.test(row.reportId) || !Array.isArray(row.chunks) || !row.chunks.length || row.chunks.length > 20) throw new Error('Invalid vector batch');
  const ids = new Set<string>();
  const chunks = row.chunks.map((value: unknown): VectorChunk => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid vector');
    const chunk = value as Record<string, unknown>;
    if (Object.keys(chunk).length !== 7 || typeof chunk.id !== 'string' || !/^[A-Za-z0-9_-]{21}$/.test(chunk.id) || ids.has(chunk.id) ||
        (chunk.kind !== 'notes' && chunk.kind !== 'reflection') || !Number.isInteger(chunk.chunkIndex) || (chunk.chunkIndex as number) < 0 || (chunk.chunkIndex as number) > 1000 ||
        typeof chunk.title !== 'string' || Array.from(chunk.title).length > 80 || typeof chunk.content !== 'string' || !chunk.content.trim() || Array.from(chunk.content).length > 400 ||
        chunk.contract !== EMBEDDING_CONTRACT || !Array.isArray(chunk.vector) || chunk.vector.length !== EMBEDDING_DIMENSIONS ||
        !chunk.vector.every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error('Invalid vector');
    const norm = Math.sqrt(chunk.vector.reduce((sum, n) => sum + n * n, 0));
    if (Math.abs(norm - 1) > 1e-4) throw new Error('Invalid vector norm');
    ids.add(chunk.id);
    return { id: chunk.id, kind: chunk.kind, chunkIndex: chunk.chunkIndex as number, title: chunk.title, content: chunk.content, contract: chunk.contract, vector: chunk.vector };
  });
  return { reportId: row.reportId, chunks };
}
export function decodeStoredVector(bytes: Uint8Array): number[] {
  if (bytes.byteLength !== EMBEDDING_DIMENSIONS * 4) throw new Error('Invalid stored vector');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => view.getFloat32(index * 4, true));
}
