import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { createId } from '@/lib/id';
import type { CommunityPostImage, CommunityPostImageDraft } from '@/types/community';

export class CommunityHttpError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'CommunityHttpError'; }
}
export function communityAccessDenied(cause: unknown): cause is CommunityHttpError { return cause instanceof CommunityHttpError && (cause.status === 403 || cause.status === 404); }
export type CommunitySession = Readonly<{ owner: string; getToken: () => Promise<string | null>; isCurrent: () => boolean }>;
const requests = new Set<AbortController>();
const creationIds = new Map<string, string>();
const pending = new Map<string, Promise<unknown>>();
export function cancelCommunityRequests(): void {
  requests.forEach(controller => controller.abort());
  requests.clear(); creationIds.clear(); pending.clear();
}
export function assertCommunitySession(session: CommunitySession): void {
  if (!session.isCurrent()) throw new Error('Community request cancelled because the signed-in account changed.');
}
export function communityConfigured(): boolean { return !!process.env.EXPO_PUBLIC_NEON_FUNCTION_URL; }
export async function communityRequest<T>(session: CommunitySession, path: string, options: { method?: string; body?: unknown; bytes?: ArrayBuffer; headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<T> {
  assertCommunitySession(session);
  const base = process.env.EXPO_PUBLIC_NEON_FUNCTION_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Online community is not configured in this build. Your drafts are safe.');
  const endpoint = new URL(base);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Community requires a configured HTTPS endpoint.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  requests.add(controller);
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, options.bytes ? 60_000 : 20_000);
  try {
    const token = await new Promise<string | null>((resolve,reject) => {
      const cancelled = () => reject(new Error('Community request cancelled or timed out. Please retry.'));
      if (controller.signal.aborted) { cancelled(); return; }
      controller.signal.addEventListener('abort', cancelled, { once: true });
      void session.getToken().then(resolve,reject).finally(() => controller.signal.removeEventListener('abort', cancelled));
    });
    assertCommunitySession(session);
    if (controller.signal.aborted) throw new Error('Community request cancelled or timed out. Please retry.');
    if (!token) throw new Error('Please sign in again to use the community.');
    const response = await fetch(`${base}/community${path}`, { method: options.method ?? 'GET', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(options.bytes ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
      ...(options.bytes ? { body: options.bytes } : options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
    assertCommunitySession(session);
    if (controller.signal.aborted) throw new Error('Community request cancelled or timed out. Please retry.');
    if (!response.ok) {
      let detail = '';
      try { const result: unknown = await response.json(); if (result && typeof result === 'object') { if ('message' in result && typeof result.message === 'string') detail = result.message; else if ('error' in result && typeof result.error === 'string') detail = result.error; } } catch { /* Preserve the HTTP failure. */ }
      assertCommunitySession(session);
      throw new CommunityHttpError(detail || (response.status === 429 ? 'Community is temporarily busy. Your draft is safe; please retry later.' : response.status === 413 ? 'Each photo must be at most 5 MiB.' : response.status === 503 ? 'Photo storage or community is temporarily unavailable. Please retry later.' : `Community request failed (${response.status}). Please retry.`),response.status);
    }
    const result: unknown = response.status === 204 ? {} : await response.json();
    assertCommunitySession(session);
    if (controller.signal.aborted) throw new Error('Community request cancelled or timed out. Please retry.');
    return result as T;
  } finally { clearTimeout(timer); requests.delete(controller); options.signal?.removeEventListener('abort', abort); }
}
/** One creation identity per failed draft; both transport retries and a second tap reuse it. */
export function communityCreation<T>(session: CommunitySession, kind: string, input: unknown, create: (id: string) => Promise<T>, explicitId?: string): Promise<T> {
  assertCommunitySession(session);
  const key = JSON.stringify([session.owner, kind, input]);
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const id = explicitId ?? creationIds.get(key) ?? createId();
  creationIds.set(key, id);
  const flight = create(id).then(result => { assertCommunitySession(session); creationIds.delete(key); return result; }).finally(() => { if (pending.get(key) === flight) pending.delete(key); });
  pending.set(key, flight);
  return flight;
}
export function mergeCommunityItems<T>(old: readonly T[], incoming: readonly T[], id: (item: T) => string): T[] {
  const items = new Map(old.map(item => [id(item), item]));
  incoming.forEach(item => items.set(id(item), item));
  return [...items.values()];
}
export async function uploadCommunityImages(session: CommunitySession, drafts: readonly CommunityPostImageDraft[], creationId: string, groupId?: string | null): Promise<CommunityPostImage[]> {
  if (drafts.length > 4) throw new Error('You can attach up to four photos.');
  const images: CommunityPostImage[] = [];
  for (const [index, draft] of drafts.entries()) {
    assertCommunitySession(session);
    const key = JSON.stringify([session.owner, 'photo', creationId, index, draft.uri]);
    const imageId = draft.imageId ?? draft.id ?? creationIds.get(key) ?? createId(); creationIds.set(key, imageId);
    const bytes = /^(file|content):/.test(draft.uri) ? await new File(draft.uri).arrayBuffer() : await (await fetch(draft.uri)).arrayBuffer();
    assertCommunitySession(session);
    if (!bytes.byteLength || bytes.byteLength > 5_242_880) throw new Error('Each photo must be nonempty and at most 5 MiB.');
    const response = await communityRequest<{ image: CommunityPostImage }>(session, '/uploads', { method: 'POST', bytes,
      headers: { 'Content-Type': draft.mimeType, 'X-Community-Image-Id': imageId, 'X-Community-File-Name': encodeURIComponent(draft.name), ...(groupId ? { 'X-Community-Group-Id': groupId } : {}) } });
    if (!response.image || response.image.imageId !== imageId) throw new Error('Photo upload acknowledgement was invalid. Your draft is safe.');
    images.push({ ...response.image, sortOrder: index });
  }
  return images;
}
