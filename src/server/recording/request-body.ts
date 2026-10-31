import { SttError } from '@/server/recording/validation';

/** Bound bytes and total upload time before parsing JSON or multipart data. */
export async function readRecordingBody(request: Request, maxBytes: number, timeoutMs = 15000): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) throw new SttError('INVALID_BODY', 'Missing recording data');
  const reader = request.body.getReader();
  let abort: (() => void) | undefined;
  const canceled = new Promise<never>((_, reject) => {
    abort = () => reject(new SttError('UPLOAD_CANCELED', 'Recording upload was canceled', 499, true));
    if (request.signal?.aborted) abort();
    else request.signal?.addEventListener('abort', abort, { once: true });
  });
  const parts: Uint8Array[] = []; let length = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SttError('UPLOAD_TIMEOUT', 'Recording upload timed out', 408, true)), timeoutMs);
  });
  try {
    while (true) {
      const result = await Promise.race([reader.read(), deadline, canceled]);
      if (result.done) break;
      length += result.value.length;
      if (length > maxBytes) throw new SttError('TOO_LARGE', 'Recording upload is too large', 413);
      parts.push(result.value);
    }
    const body = new Uint8Array(length); let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.length; }
    return body;
  } catch (error) {
    // A peer-controlled cancellation promise must not delay the error response.
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
    if (abort) request.signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
