export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_WIDTHS = [360, 900, 1600] as const;
export type CommunityImageFormat = 'jpeg' | 'png' | 'gif' | 'webp';
export type CommunityImageWidth = (typeof IMAGE_WIDTHS)[number];

export class CommunityMediaError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400, public readonly retryable = false) {
    super(message);
    this.name = 'CommunityMediaError';
  }
}

export function mediaId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{21}$/.test(value)) throw new CommunityMediaError('INVALID_IMAGE_ID', 'Invalid photo identifier');
  return value;
}

function ascii(bytes: Uint8Array, offset: number, value: string): boolean {
  return Array.from(value).every((letter, index) => bytes[offset + index] === letter.charCodeAt(0));
}

/** Client MIME and filenames are not trusted. ImageKit also must decode this as an image. */
export function validateImageBytes(bytes: Uint8Array, contentType: string | null): CommunityImageFormat {
  if (!bytes.length) throw new CommunityMediaError('EMPTY_IMAGE', 'Choose a photo to upload');
  if (bytes.length > MAX_IMAGE_BYTES) throw new CommunityMediaError('IMAGE_TOO_LARGE', 'Each photo must be 5 MiB or smaller', 413);
  let format: CommunityImageFormat | undefined;
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) && ascii(bytes, 12, 'IHDR')) format = 'png';
  else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) format = 'jpeg';
  else if (bytes.length >= 13 && (ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a'))) format = 'gif';
  else if (bytes.length >= 20 && ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP') && (ascii(bytes, 12, 'VP8 ') || ascii(bytes, 12, 'VP8L') || ascii(bytes, 12, 'VP8X'))) format = 'webp';
  if (!format) throw new CommunityMediaError('UNSUPPORTED_IMAGE', 'Choose a JPEG, PNG, GIF, or WebP photo');
  const supplied = contentType?.split(';')[0].trim().toLowerCase();
  if (supplied !== `image/${format}`) throw new CommunityMediaError('IMAGE_TYPE_MISMATCH', 'Photo type does not match its contents');
  return format;
}

export function imageWidth(value: string | null): CommunityImageWidth {
  if (value === null) return 900;
  const width = Number(value);
  if (!IMAGE_WIDTHS.includes(width as CommunityImageWidth)) throw new CommunityMediaError('INVALID_IMAGE_WIDTH', 'Unsupported photo size');
  return width as CommunityImageWidth;
}

/** Limit bytes and elapsed time even for chunked requests without Content-Length. */
export async function readImageBody(request: Request, timeoutMs = 15000): Promise<Uint8Array<ArrayBuffer>> {
  const header = request.headers.get('content-length');
  if (header !== null && (!/^\d+$/.test(header) || Number(header) > MAX_IMAGE_BYTES)) throw new CommunityMediaError('IMAGE_TOO_LARGE', 'Each photo must be 5 MiB or smaller', 413);
  if (!request.body) throw new CommunityMediaError('EMPTY_IMAGE', 'Choose a photo to upload');
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new CommunityMediaError('UPLOAD_TIMEOUT', 'Photo upload timed out; retry it', 408, true)), timeoutMs); });
  const canceled = new Promise<never>((_, reject) => {
    onAbort = () => reject(new CommunityMediaError('UPLOAD_CANCELED', 'Photo upload was canceled', 499, true));
    if (request.signal.aborted) onAbort();
    else request.signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    while (true) {
      const next = await Promise.race([reader.read(), deadline, canceled]);
      if (next.done) break;
      length += next.value.length;
      if (length > MAX_IMAGE_BYTES) throw new CommunityMediaError('IMAGE_TOO_LARGE', 'Each photo must be 5 MiB or smaller', 413);
      parts.push(next.value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.length; }
    return body;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
    if (onAbort) request.signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}
