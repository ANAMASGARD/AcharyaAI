import { addReportIndexSources, scheduleReportIndexing } from '@/lib/embeddings/indexing';
import { and, desc, eq } from 'drizzle-orm';
import { readyLocalDb } from '@/db/ready';
import { localReports, recordingSessions } from '@/db/schema';
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
      createdAt: new Date().toISOString() };
    tx.insert(localReports).values(row).onConflictDoNothing().run();
    if (!existing) addReportIndexSources(tx, row);
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
