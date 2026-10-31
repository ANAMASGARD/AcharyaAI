import { systemCleanupOperation } from './db';
import { communityErrorResponse } from './index';
import { cleanupCommunityMedia } from './media';
import { readRecordingBody } from '../recording/request-body';

/** Neon strips client-supplied X-Neon-* headers before forwarding public calls.
 * This route is valid only behind that documented Neon Functions edge boundary.
 * Pin the expected trigger as well; do not enable this on a generic HTTP host.
 */
export async function handleCommunityScheduledCleanup(request: Request): Promise<Response> {
  if (request.method !== 'POST') return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  const triggerId = process.env.COMMUNITY_NEON_TRIGGER_ID;
  const secret = process.env.COMMUNITY_CLEANUP_SECRET;
  if (!triggerId || !secret || secret.length < 32) return Response.json({ error: 'NOT_CONFIGURED' }, { status: 503 });
  const invocation = request.headers.get('X-Neon-Trigger-Invocation-Id');
  const denied = () => Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!invocation || invocation.length > 256) return denied();
  try {
    const envelope: unknown = JSON.parse(new TextDecoder().decode(await readRecordingBody(request, 8192)));
    if (!envelope || typeof envelope !== 'object' || !('version' in envelope) || envelope.version !== 1 ||
        !('invocation_id' in envelope) || typeof envelope.invocation_id !== 'string' || !envelope.invocation_id || envelope.invocation_id.length > 256 ||
        !('trigger' in envelope) || !envelope.trigger || typeof envelope.trigger !== 'object' ||
        !('type' in envelope.trigger) || envelope.trigger.type !== 'schedule' || !('id' in envelope.trigger) || envelope.trigger.id !== triggerId ||
        !('data' in envelope) || !envelope.data || typeof envelope.data !== 'object' ||
        !('scheduled_at' in envelope.data) || typeof envelope.data.scheduled_at !== 'string') return denied();
    const scheduledAt = Date.parse(envelope.data.scheduled_at);
    const age = Date.now() - scheduledAt;
    if (!Number.isFinite(scheduledAt) || age < -30_000 || age > 600_000) return denied();
  } catch { return denied(); }
  // Keep the bounded worker and scheduler credential in one implementation.
  return handleCommunityCleanup(new Request(request.url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }));
}

/** A scheduler credential is separate from every Clerk session and moderator ID. */
export async function handleCommunityCleanup(request: Request): Promise<Response> {
  const secret = process.env.COMMUNITY_CLEANUP_SECRET;
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (request.method !== 'POST') return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  if (!secret || secret.length < 32) return Response.json({ error: 'NOT_CONFIGURED' }, { status: 503 });
  const encoder = new TextEncoder();
  const [expected, actual] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(secret)),
    crypto.subtle.digest('SHA-256', encoder.encode(token ?? '')),
  ]);
  const left = new Uint8Array(expected), right = new Uint8Array(actual);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  if (!token || difference !== 0) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const result = await cleanupCommunityMedia('', 5, { operation: systemCleanupOperation });
    console.info('community_media_cleanup', { completed: result.completed, failed: result.failed });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return communityErrorResponse(error); }
}
