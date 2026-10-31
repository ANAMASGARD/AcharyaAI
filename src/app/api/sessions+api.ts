import { readRecordingBody } from '@/server/recording/request-body';
import { recordingSessions, recordingChunks, recordingRateLimits } from '@/server/db/schema/recordings';
import { recordingOwner } from '@/server/recording/auth';
import { errorResponse, id as recordingId, integer, metadata, SttError } from '@/server/recording/validation';
import { and, desc, eq } from 'drizzle-orm';

import { requireClerkUserId } from '@/server/db/auth';
import { getServerDb } from '@/server/db/client';
import { teachingSessions } from '@/server/db/schema/sessions';
import { toTeachingSessionRecord } from '@/server/sync/session-mapper';

export async function GET(request: Request) {
  const auth = await requireClerkUserId(request);
  if (!auth.ok) {
    return auth.response;
  }

  const db = getServerDb();
  const rows = await db
    .select()
    .from(teachingSessions)
    .where(eq(teachingSessions.ownerClerkId, auth.clerkUserId))
    .orderBy(desc(teachingSessions.updatedAt))
    .limit(50);

  return Response.json({
    sessions: rows.map(toTeachingSessionRecord),
  });
}

// Live recording data uses its own tables; legacy metadata sync remains independent.
export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await recordingOwner(request);
    const body = await recordingJson(request);
    const sessionId = recordingId(body.id);
    const title = metadata(body.title), subject = metadata(body.subject), grade = metadata(body.grade);
    if (typeof body.startedAt !== 'string' || !Number.isFinite(Date.parse(body.startedAt))) throw new SttError('INVALID_DATE', 'Invalid recording start time');
    const startedAt = new Date(body.startedAt);
    const db = getServerDb();
    await db.insert(recordingSessions).values({ id: sessionId, ownerClerkId: owner, title, subject, grade, startedAt }).onConflictDoNothing();
    const [existing] = await db.select().from(recordingSessions).where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.ownerClerkId, owner))).limit(1);
    if (!existing || existing.title !== title || existing.subject !== subject || existing.grade !== grade || existing.startedAt.getTime() !== startedAt.getTime()) throw new SttError('SESSION_CONFLICT', 'Recording identity already exists with different metadata', 409);
    return Response.json({ id: sessionId });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const owner = await recordingOwner(request), body = await recordingJson(request);
    const sessionId = recordingId(body.id), durationMs = integer(body.durationMs, 300000000), expectedChunkCount = integer(body.expectedChunkCount, 10001);
    if (expectedChunkCount !== Math.ceil(durationMs / 30000)) throw new SttError('INVALID_TIMING', 'Segment count does not match duration');
    if (!['finishing', 'complete', 'partial', 'failed'].includes(String(body.status))) throw new SttError('INVALID_STATUS', 'Invalid final recording state');
    const db = getServerDb();
    const [session] = await db.select().from(recordingSessions).where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.ownerClerkId, owner))).limit(1);
    if (!session) throw new SttError('NOT_FOUND', 'Recording not found', 404);
    if (session.status !== 'recording' && (session.durationMs !== durationMs || session.expectedChunkCount !== expectedChunkCount)) throw new SttError('SESSION_FINALIZED', 'Final recording duration and segment count cannot change', 409);
    const chunks = await db.select().from(recordingChunks).where(eq(recordingChunks.sessionId, sessionId)).orderBy(recordingChunks.chunkIndex);
    if (body.status === 'complete' && (chunks.length !== expectedChunkCount || chunks.some((chunk, i) => chunk.chunkIndex !== i || !['done', 'empty'].includes(chunk.status)) || Math.abs(chunks.reduce((total, chunk) => total + chunk.durationMs, 0) - durationMs) > expectedChunkCount)) throw new SttError('INCOMPLETE', 'Some recording segments still need transcription', 409, true);
    const [updated] = await db.update(recordingSessions).set({ durationMs, expectedChunkCount, status: String(body.status), updatedAt: new Date() }).where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.ownerClerkId, owner), eq(recordingSessions.status, session.status), eq(recordingSessions.durationMs, session.durationMs), eq(recordingSessions.expectedChunkCount, session.expectedChunkCount))).returning({ id: recordingSessions.id });
    if (!updated) throw new SttError('SESSION_CHANGED', 'Recording changed while finalizing; retry finalization', 409, true);
    return Response.json({ id: sessionId });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const owner = await recordingOwner(request), db = getServerDb();
    // FK cascade removes in-flight claims. Fenced completion cannot recreate deleted rows.
    await db.delete(recordingSessions).where(eq(recordingSessions.ownerClerkId, owner));
    await db.delete(recordingRateLimits).where(eq(recordingRateLimits.ownerClerkId, owner));
    return Response.json({ deleted: true });
  } catch (error) { return errorResponse(error); }
}

async function recordingJson(request: Request): Promise<Record<string, unknown>> {
  const text = new TextDecoder().decode(await readRecordingBody(request, 4096));
  let body: unknown; try { body = JSON.parse(text); } catch { throw new SttError('INVALID_JSON', 'Invalid recording metadata'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SttError('INVALID_JSON', 'Invalid recording metadata');
  return body as Record<string, unknown>;
}
