import { addReportIndexSources, scheduleReportIndexing } from '@/lib/embeddings/indexing';
import { and, asc, desc, eq, gt, or, isNotNull } from 'drizzle-orm';
import { readyLocalDb } from '@/db/ready';
import { localReports, recordingSessions, recordingChunks, reportCheckpoints } from '@/db/schema';
import type { ClassReportResult } from '@/lib/ai/class-report';
import { parseTeachingReport } from '@/lib/ai/class-report';
import { assertAcharyaId } from '@/lib/validate-id';
import type { RecordingSession } from '@/lib/recording/types';
import type { CalendarSession, SessionDetail } from '@/types/calendar';

export async function saveReportHistory(owner: string, session: RecordingSession, result: ClassReportResult, signal: AbortSignal): Promise<void> {
  assertAcharyaId(session.id);
  if (owner !== session.ownerClerkId) throw new Error('Report owner mismatch');
  const db = await readyLocalDb();
  // No asynchronous boundary between this fence and the transaction commit.
  if (signal.aborted) throw new Error('Report save cancelled');
  db.transaction((tx) => {
    const recording = tx.select().from(recordingSessions).where(and(eq(recordingSessions.id, session.id), eq(recordingSessions.ownerClerkId, owner))).get();
    if (!recording) throw new Error('Recording is no longer available');
    const existing = tx.select().from(localReports).where(eq(localReports.sessionId, session.id)).get();
    if (existing && existing.ownerClerkId !== owner) throw new Error('Report owner mismatch');
    // First acknowledgement wins. Retrying a local save must not duplicate history.
    const row = { sessionId: session.id, ownerClerkId: owner,
      title: session.title, subject: session.subject, grade: session.grade,
      recordedAt: session.startedAt, durationMs: session.durationMs,
      reportJson: JSON.stringify(result.report), classNotes: result.classNotes, model: result.model,
      backend: result.backend ?? 'online', cloudShareAllowed: result.backend !== 'offline', sourceHash: result.sourceHash ?? null, promptVersion: result.promptVersion ?? null,
      createdAt: new Date().toISOString() };
    tx.insert(localReports).values(row).onConflictDoNothing().run();
    if (!existing) addReportIndexSources(tx, row);
    tx.delete(reportCheckpoints).where(and(eq(reportCheckpoints.owner, owner), eq(reportCheckpoints.sessionId, session.id))).run();
  });
  void scheduleReportIndexing(owner).catch(() => {});
}

function sessionFromRow(row: typeof localReports.$inferSelect): CalendarSession {
  return { sessionId: row.sessionId, teacherClerkId: row.ownerClerkId, topic: row.title,
    subject: row.subject, classLevel: row.grade, recordedAt: row.recordedAt,
    durationSeconds: Math.round(row.durationMs / 1000), score: parseTeachingReport(row.reportJson).overallScore };
}
export async function listReportHistory(owner: string): Promise<CalendarSession[]> {
  const db = await readyLocalDb();
  return db.select().from(localReports).where(eq(localReports.ownerClerkId, owner))
    .orderBy(desc(localReports.recordedAt)).all().map(sessionFromRow);
}
export async function readReportHistory(owner: string, sessionId: string): Promise<SessionDetail | null> {
  const db = await readyLocalDb();
  const row = db.select().from(localReports).where(and(eq(localReports.ownerClerkId, owner), eq(localReports.sessionId, sessionId))).get();
  return row ? { session: sessionFromRow(row), report: parseTeachingReport(row.reportJson), classNotes: row.classNotes, transcriptPreview: null } : null;
}

/** A saved class exists independently of optional online analysis. */
export async function listClassHistory(owner: string): Promise<CalendarSession[]> {
  const db = await readyLocalDb();
  return db.select({ recording: recordingSessions, report: localReports }).from(recordingSessions)
    .leftJoin(localReports, and(eq(localReports.sessionId, recordingSessions.id), eq(localReports.ownerClerkId, owner)))
    .where(and(eq(recordingSessions.ownerClerkId, owner), or(gt(recordingSessions.expectedChunkCount, 0), isNotNull(localReports.sessionId))))
    .orderBy(desc(recordingSessions.startedAt)).all().map(({ recording: row, report }) => ({
      sessionId: row.id, teacherClerkId: row.ownerClerkId, topic: row.title, subject: row.subject, classLevel: row.grade,
      recordedAt: row.startedAt, durationSeconds: Math.round(row.durationMs / 1000),
      score: report ? parseTeachingReport(report.reportJson).overallScore : undefined,
      stateLabel: report ? 'Report ready' : row.serverFinalized && row.status === 'complete' ? 'Transcript saved' :
        row.serverFinalized && row.status === 'partial' ? 'Partial transcript' : 'Transcription unfinished',
    }));
}
export async function readClassHistory(owner: string, sessionId: string): Promise<SessionDetail | null> {
  assertAcharyaId(sessionId);
  const db = await readyLocalDb();
  const session = db.select().from(recordingSessions).where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.ownerClerkId, owner))).get();
  if (!session) return null;
  const chunks = db.select().from(recordingChunks).where(eq(recordingChunks.sessionId, sessionId)).orderBy(asc(recordingChunks.index)).all();
  const report = await readReportHistory(owner, sessionId);
  return { session: report?.session ?? { sessionId, teacherClerkId: owner, topic: session.title, subject: session.subject, classLevel: session.grade,
    recordedAt: session.startedAt, durationSeconds: Math.round(session.durationMs / 1000) },
    report: report?.report ?? null, classNotes: report?.classNotes ?? null, transcriptPreview: null,
    recording: { session, chunks }, transcript: chunks.map(c => c.status === 'done' ? c.transcript.trim() : c.status === 'empty' ? '[inaudible]' : `[Segment ${c.index + 1}: ${c.status}]`).join('\n\n') };
}
export async function readSavedReportResult(owner: string, sessionId: string): Promise<ClassReportResult | null> {
  const db = await readyLocalDb();
  const row = db.select().from(localReports).where(and(eq(localReports.ownerClerkId, owner), eq(localReports.sessionId, sessionId))).get();
  return row ? { report: parseTeachingReport(row.reportJson), classNotes: row.classNotes, model: row.model, backend: row.backend, sourceHash: row.sourceHash ?? undefined, promptVersion: row.promptVersion ?? undefined } : null;
}

export async function reportSharingAllowed(owner: string, sessionId: string): Promise<boolean> {
  const db = await readyLocalDb();
  return db.select().from(localReports).where(and(eq(localReports.ownerClerkId, owner), eq(localReports.sessionId, sessionId))).get()?.cloudShareAllowed ?? false;
}
export async function allowReportSharing(owner: string, sessionId: string, signal?: AbortSignal): Promise<void> {
  const db = await readyLocalDb();
  if (signal?.aborted) throw new Error('Sharing cancelled');
  db.update(localReports).set({ cloudShareAllowed: true }).where(and(eq(localReports.ownerClerkId, owner), eq(localReports.sessionId, sessionId))).run();
}
