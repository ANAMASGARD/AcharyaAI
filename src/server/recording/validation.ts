export class SttError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400, public readonly retryable = false, public readonly retryAfterMs?: number) { super(message); }
}
export function errorResponse(error: unknown): Response {
  const safe = error instanceof SttError ? error : new SttError('SERVER_ERROR', 'Recording service unavailable', 503, true);
  return Response.json({ error: { code: safe.code, message: safe.message, retryable: safe.retryable, ...(safe.retryAfterMs ? { retryAfterMs: safe.retryAfterMs } : {}) } }, { status: safe.status });
}
export function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{21}$/.test(value)) throw new SttError('INVALID_ID', 'Invalid recording identifier');
  return value;
}
export function integer(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new SttError('INVALID_NUMBER', 'Invalid recording timing');
  return value;
}
export function metadata(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new SttError('INVALID_METADATA', 'Topic, subject and class are required (maximum 200 characters each)');
  return value.trim();
}
export function validateWav(bytes: Uint8Array, durationMs: number): void {
  const fail = () => { throw new SttError('INVALID_AUDIO', 'Expected a PCM16 mono 16 kHz WAV of at most 30 seconds'); };
  if (bytes.length <= 44 || bytes.length > 960044 || (bytes.length - 44) % 2) fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number, value: string) => [...value].every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  if (!tag(0, 'RIFF') || !tag(8, 'WAVE') || !tag(12, 'fmt ') || !tag(36, 'data') || view.getUint32(4, true) !== bytes.length - 8 || view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1 || view.getUint32(24, true) !== 16000 || view.getUint32(28, true) !== 32000 || view.getUint16(32, true) !== 2 || view.getUint16(34, true) !== 16 || view.getUint32(40, true) !== bytes.length - 44) fail();
  if (Math.abs((bytes.length - 44) / 32 - durationMs) > 1) fail();
}
