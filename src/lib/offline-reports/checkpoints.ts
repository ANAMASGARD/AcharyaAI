import { and, eq, ne } from 'drizzle-orm';
import { readyLocalDb } from '@/db/ready';
import { reportCheckpoints, recordingSessions } from '@/db/schema';
import { createId } from '@/lib/id';
export async function reportCheckpointStore(owner: string, sessionId: string, fingerprint: string, signal: AbortSignal) {
  const db = await readyLocalDb();
  const fence = () => {
    if (signal.aborted) throw new Error('Report cancelled.');
    if (!db.select().from(recordingSessions).where(and(eq(recordingSessions.id, sessionId), eq(recordingSessions.ownerClerkId, owner))).get()) throw new Error('Saved class is unavailable.');
  };
  fence();
  db.delete(reportCheckpoints).where(and(eq(reportCheckpoints.owner, owner), eq(reportCheckpoints.sessionId, sessionId), ne(reportCheckpoints.fingerprint, fingerprint))).run();
  const where = (stage: string) => and(eq(reportCheckpoints.owner, owner), eq(reportCheckpoints.sessionId, sessionId), eq(reportCheckpoints.fingerprint, fingerprint), eq(reportCheckpoints.stage, stage));
  return {
    read: async (stage: string): Promise<string | null> => { fence(); return db.select().from(reportCheckpoints).where(where(stage)).get()?.value ?? null; },
    write: async (stage: string, value: string): Promise<void> => {
      fence(); db.insert(reportCheckpoints).values({ id: createId(), owner, sessionId, fingerprint, stage, value }).onConflictDoNothing().run();
    },
  };
}
