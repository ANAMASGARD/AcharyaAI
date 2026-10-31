import { readRecordingBody } from '@/server/recording/request-body';
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { getServerDb } from '@/server/db/client';
import { recordingChunks, recordingRateLimits, recordingSessions } from '@/server/db/schema/recordings';
import { recordingOwner } from '@/server/recording/auth';
import { errorResponse, id, integer, SttError, validateWav } from '@/server/recording/validation';
import { transcribeWithGnani } from '@/server/recording/provider';

export async function POST(request: Request): Promise<Response> {
  try {
    const owner = await recordingOwner(request);
    const body = await readRecordingBody(request, 980000);
    let form: { get(name: string): unknown };
    try { form = await new Response(body, { headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' } }).formData() as unknown as { get(name: string): unknown }; }
    catch { throw new SttError('INVALID_FORM', 'Expected multipart recording data'); }
    const sessionId = id(form.get('sessionId')); const chunkId = id(form.get('chunkId'));
    const numeric = (key: string, max: number) => { const raw = form.get(key); if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new SttError('INVALID_NUMBER', 'Invalid segment timing'); return integer(Number(raw), max); };
    const chunkIndex = numeric('chunkIndex', 10000), startMs = numeric('startMs', 300000000), durationMs = numeric('durationMs', 30000);
    if (durationMs < 1 || startMs !== chunkIndex * 30000) throw new SttError('INVALID_TIMING', 'Invalid segment ordering');
    const audio = form.get('audio');
    if (!(audio instanceof Blob)) throw new SttError('INVALID_AUDIO', 'Missing audio');
    const bytes = new Uint8Array(await audio.arrayBuffer()); validateWav(bytes, durationMs);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
    const db = getServerDb();
    const [session] = await db.select().from(recordingSessions).where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.ownerClerkId, owner))).limit(1);
    if (!session) throw new SttError('NOT_FOUND', 'Recording not found', 404);
    if (session.status !== 'recording' && (chunkIndex >= session.expectedChunkCount || startMs + durationMs > session.durationMs + 1)) throw new SttError('SESSION_FINALIZED', 'Segment is outside the finalized recording', 409);
    await db.insert(recordingChunks).values({ id: chunkId, sessionId, chunkIndex, startMs, durationMs, audioHash: hash }).onConflictDoNothing();
    const [chunk] = await db.select().from(recordingChunks).where(eq(recordingChunks.id, chunkId)).limit(1);
    if (!chunk || chunk.sessionId !== sessionId || chunk.chunkIndex !== chunkIndex || chunk.startMs !== startMs || chunk.durationMs !== durationMs || chunk.audioHash !== hash) throw new SttError('CHUNK_CONFLICT', 'Segment identity conflicts with an existing upload', 409);
    if (chunk.status === 'done' || chunk.status === 'empty') return Response.json({ chunkId, chunkIndex, transcript: chunk.transcript, status: chunk.status });
    const now = new Date();
    const [rate] = await db.insert(recordingRateLimits).values({ ownerClerkId: owner, lastRequestAt: now }).onConflictDoUpdate({ target: recordingRateLimits.ownerClerkId, set: { lastRequestAt: now }, setWhere: lt(recordingRateLimits.lastRequestAt, new Date(now.getTime() - 1000)) }).returning();
    if (!rate) throw new SttError('RATE_LIMIT', 'Please wait before retrying', 429, true, 1000);
    const token = crypto.randomUUID();
    const [claimed] = await db.update(recordingChunks).set({ status: 'processing', claimToken: token, leaseUntil: new Date(now.getTime() + 120000), updatedAt: now, attempts: sql`${recordingChunks.attempts} + 1`, errorCode: null }).where(and(eq(recordingChunks.id, chunkId), or(inArray(recordingChunks.status, ['pending', 'failed']), and(eq(recordingChunks.status, 'processing'), lt(recordingChunks.leaseUntil, now))))).returning();
    if (!claimed) throw new SttError('PROCESSING', 'Segment is already processing', 409, true, 4000);
    try {
      // Recheck after claiming so deletion cannot cause a new provider call from stale metadata.
      const [active] = await db.select({ id: recordingSessions.id }).from(recordingSessions).where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.ownerClerkId, owner))).limit(1);
      if (!active) throw new SttError('NOT_FOUND', 'Recording was deleted', 404);
      const transcript = await transcribeWithGnani(audio); const status = transcript ? 'done' : 'empty';
      const [saved] = await db.update(recordingChunks).set({ transcript, status, leaseUntil: null, claimToken: null, updatedAt: new Date() }).where(and(eq(recordingChunks.id, chunkId), eq(recordingChunks.claimToken, token))).returning();
      if (!saved) throw new SttError('CLAIM_EXPIRED', 'Recording was deleted or processing was reclaimed', 409, true);
      return Response.json({ chunkId, chunkIndex, transcript, status });
    } catch (error) {
      await db.update(recordingChunks).set({ status: 'failed', errorCode: error instanceof SttError ? error.code : 'SERVER_ERROR', leaseUntil: null, claimToken: null, updatedAt: new Date() }).where(and(eq(recordingChunks.id, chunkId), eq(recordingChunks.claimToken, token)));
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}
