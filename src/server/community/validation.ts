const idPattern = /^[A-Za-z0-9_-]{21}$/;

export class CommunityRequestError extends Error {
  constructor(message = 'INVALID_REQUEST', readonly status = 400) { super(message); }
}

export function communityId(value: unknown): string {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new CommunityRequestError();
  return value;
}

export function communityText(value: unknown, max: number, required = true): string {
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) throw new CommunityRequestError();
  return value.trim();
}

export function communityLink(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const text = communityText(value, 2048);
  try {
    const url = new URL(text);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new CommunityRequestError(); }
}

export function communityImages(value: unknown): { imageId: string }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 4) throw new CommunityRequestError();
  const images = value.map(image => {
    if (!image || typeof image !== 'object' || !('imageId' in image)) throw new CommunityRequestError();
    return { imageId: communityId(image.imageId) };
  });
  if (new Set(images.map(image => image.imageId)).size !== images.length) throw new CommunityRequestError();
  return images;
}

export function communityCursor(value: string | null): { createdAt: string; id: string } | undefined {
  if (value === null) return undefined;
  try {
    if (value.length > 300) throw new Error();
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || !('createdAt' in parsed) || !('id' in parsed) ||
        typeof parsed.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(parsed.createdAt) || !Number.isFinite(Date.parse(parsed.createdAt))) throw new Error();
    return { createdAt: parsed.createdAt, id: communityId(parsed.id) };
  } catch { throw new CommunityRequestError('INVALID_CURSOR'); }
}

export function communityPage(params: URLSearchParams): Record<string, unknown> {
  const limitText = params.get('limit') ?? '20';
  if (!/^\d{1,2}$/.test(limitText)) throw new CommunityRequestError();
  const limit = Number(limitText);
  if (limit < 1 || limit > 50) throw new CommunityRequestError();
  const cursor = communityCursor(params.get('cursor'));
  const after = communityCursor(params.get('after'));
  if (cursor && after) throw new CommunityRequestError('INVALID_CURSOR');
  return { limit, ...(cursor ? { cursor } : {}), ...(after ? { after } : {}) };
}

export function communityBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CommunityRequestError();
  return value as Record<string, unknown>;
}
