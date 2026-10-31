// Server-only: never import this module from mobile components, hooks, or stores.
import ImageKit, { toFile } from '@imagekit/nodejs';

import { CommunityMediaError, MAX_IMAGE_BYTES, type CommunityImageFormat, type CommunityImageWidth } from './media-validation';

export interface StoredCommunityImage {
  fileId: string;
  filePath: string;
  width: number;
  height: number;
  format: CommunityImageFormat;
  sizeBytes: number;
}

export interface CommunityImageProvider {
  upload(bytes: Uint8Array<ArrayBuffer>, imageId: string, format: CommunityImageFormat, contentHash: string): Promise<StoredCommunityImage>;
  sign(filePath: string, width: CommunityImageWidth): { url: string; expiresAt: string };
  remove(fileId: string | null, filePath: string): Promise<void>;
}

function providerError(error: unknown): CommunityMediaError {
  if (error instanceof CommunityMediaError) return error;
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 402 || status === 429 || status === 507) return new CommunityMediaError('MEDIA_LIMIT', 'Photo service capacity is temporarily unavailable; keep your draft and try later', 503, true);
  if (status === 400 || status === 415 || status === 422) return new CommunityMediaError('PHOTO_REJECTED', 'Photo could not be processed; choose a different image', 422);
  return new CommunityMediaError('MEDIA_UNAVAILABLE', 'Photo service is unavailable; keep your draft and retry', 503, true);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo service returned an invalid response', 502, true);
  return value as Record<string, unknown>;
}

export function validateProviderImage(value: unknown, filePath: string, format: CommunityImageFormat, sizeBytes: number, contentHash: string): StoredCommunityImage {
  const data = object(value);
  const positive = (number: unknown): number => {
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0) throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo service returned invalid image dimensions', 502, true);
    return number;
  };
  if (data.filePath !== filePath || typeof data.fileId !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(data.fileId) || data.isPrivateFile !== true || data.fileType !== 'image' || data.size !== sizeBytes || sizeBytes > MAX_IMAGE_BYTES || !Array.isArray(data.tags) || !data.tags.includes(`acharya-sha256-${contentHash}`)) {
    throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo service returned invalid private image metadata', 502, true);
  }
  if (data.mime !== undefined && data.mime !== `image/${format}`) throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo service returned a different image type', 502, true);
  const width = positive(data.width), height = positive(data.height);
  if (width * height > 100_000_000) throw new CommunityMediaError('IMAGE_DIMENSIONS', 'Choose a photo with smaller dimensions', 422);
  return { fileId: data.fileId, filePath, format, sizeBytes, width, height };
}

function checkedPath(filePath: string): void {
  if (!/^\/acharya\/community\/[A-Za-z0-9_-]{21}\.(jpeg|png|gif|webp)$/.test(filePath)) throw new CommunityMediaError('INVALID_IMAGE_PATH', 'Invalid photo path');
}

/** SDK retries are disabled: deterministic paths + reconciliation make retries safe. */
export function createImageKitProvider(): CommunityImageProvider {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!privateKey || !urlEndpoint) throw new CommunityMediaError('MEDIA_NOT_CONFIGURED', 'Photo uploads are not configured yet', 503);
  let endpoint: URL;
  try { endpoint = new URL(urlEndpoint); } catch { throw new CommunityMediaError('MEDIA_NOT_CONFIGURED', 'Photo delivery is not configured', 503); }
  if (endpoint.protocol !== 'https:' || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) throw new CommunityMediaError('MEDIA_NOT_CONFIGURED', 'Photo delivery is not configured', 503);
  const client = new ImageKit({ privateKey, timeout: 25000, maxRetries: 0 });
  const base = urlEndpoint.replace(/\/$/, '');
  async function find(filePath: string): Promise<Record<string, unknown> | null> {
    checkedPath(filePath);
    const name = filePath.split('/').at(-1)!;
    const matches = await client.assets.list({ path: '/acharya/community/', searchQuery: `name = "${name}"`, type: 'file', limit: 1000 }, { timeout: 5000 });
    if (!Array.isArray(matches)) throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo service returned an invalid listing', 502, true);
    const exact = matches.map(object).filter(item => item.filePath === filePath);
    if (exact.length > 1) throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo service returned duplicate images', 502, true);
    if (!exact.length) return null;
    if (typeof exact[0].fileId !== 'string') throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo service returned an invalid image', 502, true);
    return object(await client.files.get(exact[0].fileId, { timeout: 5000 }));
  }
  return {
    async upload(bytes, imageId, format, contentHash) {
      const filePath = `/acharya/community/${imageId}.${format}`;
      checkedPath(filePath);
      try {
        let existing = await find(filePath);
        if (!existing) {
          try {
            const result = await client.files.upload({
              file: await toFile(bytes, `${imageId}.${format}`, { type: `image/${format}` }),
              fileName: `${imageId}.${format}`, folder: '/acharya/community',
              useUniqueFileName: false, overwriteFile: false, isPrivateFile: true,
              tags: [`acharya-sha256-${contentHash}`], responseFields: ['isPrivateFile', 'tags'],
            });
            // A subsequent GET verifies the persisted object, rather than trusting an acknowledgement.
            if (typeof result.fileId !== 'string') throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo service returned an invalid upload', 502, true);
            existing = object(await client.files.get(result.fileId, { timeout: 5000 }));
          } catch (error) {
            // Covers concurrent retries and a successful upload whose response was lost.
            existing = await find(filePath);
            if (!existing) throw error;
          }
        }
        return validateProviderImage(existing, filePath, format, bytes.length, contentHash);
      } catch (error) { throw providerError(error); }
    },
    sign(filePath, width) {
      checkedPath(filePath);
      const url = client.helper.buildSrc({ urlEndpoint: base, src: filePath, transformation: [{ width, quality: 85, format: 'auto' }], signed: true, expiresIn: 300 });
      const parsed = new URL(url);
      const expiry = Number(parsed.searchParams.get('ik-t'));
      if (!parsed.searchParams.get('ik-s') || !Number.isInteger(expiry) || expiry < Date.now() / 1000 + 290 || expiry > Date.now() / 1000 + 301) throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo signing failed', 503, true);
      return { url, expiresAt: new Date(expiry * 1000).toISOString() };
    },
    async remove(fileId, filePath) {
      checkedPath(filePath);
      try {
        // Resolve the path even after a timeout or failed DB registration left file_id null.
        const existing = await find(filePath);
        if (existing && (typeof existing.fileId !== 'string' || (fileId && fileId !== existing.fileId))) throw new CommunityMediaError('MEDIA_RESPONSE', 'Photo deletion metadata does not match', 502, true);
        const id = existing?.fileId ?? fileId;
        if (typeof id === 'string') {
          try { await client.files.delete(id, { timeout: 5000 }); }
          catch (error) { if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) throw error; }
        }
        // Deletion does not itself purge CDN caches. Queue invalidations for every served width.
        for (const width of [undefined, 360, 900, 1600]) {
          const url = client.helper.buildSrc({ urlEndpoint: base, src: filePath, ...(width ? { transformation: [{ width, quality: 85, format: 'auto' }] } : {}) });
          await client.cache.invalidation.create({ url }, { timeout: 5000 });
        }
      } catch (error) { throw providerError(error); }
    },
  };
}
