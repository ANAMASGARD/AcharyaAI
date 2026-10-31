import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { and, eq, isNull, isNotNull, count, sql } from 'drizzle-orm';
import { Platform } from 'react-native';
import { readyLocalDb } from '@/db/ready';
import { embeddingAccounts, localReports, reportVectors } from '@/db/schema';
import { createId } from '@/lib/id';
import { EMBEDDING_CONTRACT, reportSourceChunks } from './contract';

type Bridge = { available: boolean; scheduleReportIndex(owner: string, generation: string): Promise<void>; cancelReportIndex(owner: string): Promise<void>; getIndexingDiagnostic(owner: string): Promise<{ state: string; error: string | null }> };
const native = Platform.OS === 'android' && !isRunningInExpoGo() ? requireOptionalNativeModule<Bridge>('AcharyaEmbeddings') : null;
const grants = new Map<string, string>();
export function addReportIndexSources(tx: Parameters<Parameters<Awaited<ReturnType<typeof readyLocalDb>>['transaction']>[0]>[0], row: typeof localReports.$inferInsert): void {
  let sequence = tx.select({ value: sql<number>`coalesce(max(${reportVectors.enqueueSequence}), 0) + 1` }).from(reportVectors).get()?.value ?? 1;
  for (const chunk of reportSourceChunks(row.title, row.classNotes, row.reportJson)) {
    tx.insert(reportVectors).values({ ...chunk, id: createId(), sessionId: row.sessionId, owner: row.ownerClerkId, contract: EMBEDDING_CONTRACT, enqueueSequence: sequence++ }).onConflictDoNothing().run();
  }
}
export async function startReportIndexing(owner: string): Promise<void> {
  if (!native?.available) return;
  const generation = createId(); grants.set(owner, generation);
  const db = await readyLocalDb();
  if (grants.get(owner) !== generation) return;
  db.insert(embeddingAccounts).values({ owner, generation }).onConflictDoUpdate({ target: embeddingAccounts.owner, set: { generation } }).run();
  // Import reports made before this release, without invoking the report provider again.
  db.transaction(tx => {
    const reports = tx.select().from(localReports).where(eq(localReports.ownerClerkId, owner)).all();
    for (const row of reports) addReportIndexSources(tx, row);
  });
  await native.cancelReportIndex(owner);
  if (grants.get(owner) !== generation) return;
  await scheduleReportIndexing(owner);
}
export async function scheduleReportIndexing(owner: string): Promise<void> {
  const generation = grants.get(owner);
  if (!native?.available || !generation) return;
  const db = await readyLocalDb();
  if (grants.get(owner) !== generation || !db.select().from(reportVectors).where(and(eq(reportVectors.owner, owner), isNull(reportVectors.vector))).limit(1).get()) return;
  await native.scheduleReportIndex(owner, generation);
}
export async function stopReportIndexing(owner: string): Promise<void> {
  const generation = grants.get(owner);
  grants.delete(owner);
  const db = await readyLocalDb();
  if (grants.has(owner)) return;
  if (generation) db.delete(embeddingAccounts).where(and(eq(embeddingAccounts.owner, owner), eq(embeddingAccounts.generation, generation))).run();
  else db.delete(embeddingAccounts).where(eq(embeddingAccounts.owner, owner)).run();
  await native?.cancelReportIndex(owner);
}


export async function reportIndexStatus(owner: string): Promise<{ ready: number; pending: number; state: string; error: string | null }> {
  const db = await readyLocalDb();
  const ready = db.select({ value: count() }).from(reportVectors).where(and(eq(reportVectors.owner, owner), isNotNull(reportVectors.vector))).get()?.value ?? 0;
  const pending = db.select({ value: count() }).from(reportVectors).where(and(eq(reportVectors.owner, owner), isNull(reportVectors.vector))).get()?.value ?? 0;
  const diagnostic = native?.getIndexingDiagnostic ? await native.getIndexingDiagnostic(owner) : { state: 'unavailable', error: null };
  return { ready, pending, ...diagnostic };
}
