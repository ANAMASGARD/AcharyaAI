import { addReportIndexSources, scheduleReportIndexing } from '@/lib/embeddings/indexing';
import { validateVectorBatch, decodeStoredVector } from '@/lib/embeddings/sync-contract';
import { and, eq, isNull, asc, sql, inArray } from 'drizzle-orm';
import { readyLocalDb } from '@/db/ready';
import { localReports, recordingSessions, reportSyncAccounts, reportSyncAcks, reportVectors } from '@/db/schema';
import { validateSyncedReport, type SyncedReport } from './sync-contract';

type Token = () => Promise<string | null>;
const flights = new Map<string, AbortController>();
const listeners = new Set<() => void>();
export const onReportSyncChange = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function changed() { listeners.forEach(listener => listener()); }
export function cloudConfigured(): boolean { return !!process.env.EXPO_PUBLIC_NEON_FUNCTION_URL; }
export function stopReportSync(owner: string): void { flights.get(owner)?.abort(); }
export async function reportSyncStatus(owner: string) {
  const db = await readyLocalDb();
  const existing = db.select().from(reportSyncAccounts).where(eq(reportSyncAccounts.owner, owner)).get();
  if (existing || !cloudConfigured()) return existing;
  // New accounts sync automatically; a teacher's explicit Off choice persists.
  db.insert(reportSyncAccounts).values({ owner, enabled: true }).onConflictDoNothing().run();
  return db.select().from(reportSyncAccounts).where(eq(reportSyncAccounts.owner, owner)).get();
}
export async function setReportSyncConsent(owner: string, enabled: boolean): Promise<void> {
  stopReportSync(owner);
  if (enabled && !cloudConfigured()) throw new Error('Cloud sync is not configured in this build.');
  const db = await readyLocalDb();
  db.insert(reportSyncAccounts).values({ owner, enabled }).onConflictDoUpdate({ target: reportSyncAccounts.owner, set: { enabled, lastError: null } }).run();
  changed();
}
export async function clearReportSync(owner: string): Promise<void> {
  stopReportSync(owner);
  const db = await readyLocalDb();
  db.transaction(tx => {
    tx.delete(reportSyncAcks).where(eq(reportSyncAcks.owner, owner)).run();
    tx.delete(reportSyncAccounts).where(eq(reportSyncAccounts.owner, owner)).run();
  });
}
async function request(getToken: Token, path: string, signal: AbortSignal, method = 'GET', body?: unknown): Promise<unknown> {
  const base = process.env.EXPO_PUBLIC_NEON_FUNCTION_URL?.replace(/\/$/, '');
  if (!base || new URL(base).protocol !== 'https:') throw new Error('Cloud sync needs a configured HTTPS endpoint.');
  const token = await getToken();
  if (signal.aborted) throw new Error('Sync cancelled');
  if (!token) throw new Error('Sign in again to synchronize.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 20_000);
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (signal.aborted || controller.signal.aborted) throw new Error('Sync cancelled or timed out');
      const response = await fetch(`${base}${path}`, { method, signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      if (response.status === 429 && attempt < 3) {
        const retry = Number(response.headers?.get?.('Retry-After'));
        await pause(signal, Math.min(5000, Math.max(1000 * (attempt + 1), Number.isFinite(retry) ? retry * 1000 : 0)));
        continue;
      }
      if (!response.ok) throw new Error(response.status === 409 ? 'A report conflicts with its cloud copy. Your local report is safe.' : `Cloud sync failed (${response.status}). Your local reports are safe.`);
      const value: unknown = await response.json();
      if (signal.aborted) throw new Error('Sync cancelled');
      return value;
    }
    throw new Error('Sync is temporarily rate limited. Queued reports remain on this device.');
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}
export async function deleteCloudAccount(getToken: Token): Promise<void> {
  await request(getToken, '/account', new AbortController().signal, 'DELETE');
}
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const revision = (value: unknown): value is string => typeof value === 'string' && /^\d{1,18}$/.test(value);

export async function syncReports(owner: string, getToken: Token): Promise<void> {
  if (flights.has(owner) || !cloudConfigured()) return;
  const controller = new AbortController(); flights.set(owner, controller);
  const signal = controller.signal;
  try {
    const db = await readyLocalDb();
    const allowed = () => { if (signal.aborted) throw new Error('Sync cancelled'); if (!db.select().from(reportSyncAccounts).where(eq(reportSyncAccounts.owner, owner)).get()?.enabled) throw new Error('Sync paused'); };
    if (!(await reportSyncStatus(owner))?.enabled) return;
    const pending = db.select({ report: localReports }).from(localReports).leftJoin(reportSyncAcks, and(eq(reportSyncAcks.id, localReports.sessionId), eq(reportSyncAcks.owner, owner)))
      .where(and(eq(localReports.ownerClerkId, owner), eq(localReports.cloudShareAllowed, true), isNull(reportSyncAcks.id))).orderBy(sql`local_reports.rowid`).limit(20).all();
    for (const { report: row } of pending) {
      allowed();
      const payload = validateSyncedReport({ id: row.sessionId, title: row.title, subject: row.subject, grade: row.grade,
        recordedAt: row.recordedAt, durationMs: row.durationMs, reportJson: row.reportJson, classNotes: row.classNotes, model: row.model, createdAt: row.createdAt });
      const ack = await request(getToken, '/reports', signal, 'POST', payload);
      allowed();
      if (!isObject(ack) || ack.id !== row.sessionId || !revision(ack.revision)) throw new Error('Invalid cloud acknowledgement');
      db.insert(reportSyncAcks).values({ owner, id: row.sessionId, revision: ack.revision }).onConflictDoNothing().run();
      await pause(signal);
    }
    // Report acknowledgements precede their vector upload. Offline vectors stay queued.
    // Persistent sequence makes FIFO explicit, independent of random IDs or row layout.
    // A failed/unready head remains queued; younger vectors cannot overtake it.
    for (let batch = 0; batch < 10; batch++) {
      const pending = db.select().from(reportVectors).where(and(eq(reportVectors.owner, owner), eq(reportVectors.synced, false), inArray(reportVectors.sessionId, db.select({ id: localReports.sessionId }).from(localReports).where(and(eq(localReports.ownerClerkId, owner), eq(localReports.cloudShareAllowed, true))))))
        .orderBy(asc(reportVectors.enqueueSequence)).limit(20).all();
      if (!pending.length || pending[0].vector === null) break;
      const reportId = pending[0].sessionId;
      const group: typeof pending = [];
      for (const row of pending) {
        if (row.sessionId !== reportId || row.vector === null) break;
        group.push(row);
      }
      const acked = db.select().from(reportSyncAcks).where(and(eq(reportSyncAcks.id, reportId), eq(reportSyncAcks.owner, owner))).get();
      if (!acked) break;
      allowed();
      const payload = validateVectorBatch({ reportId, chunks: group.map(row => ({ id: row.id, kind: row.kind, chunkIndex: row.chunkIndex,
        title: row.title, content: row.content, contract: row.contract, vector: decodeStoredVector(new Uint8Array(row.vector!)) })) });
      const ack = await request(getToken, '/vectors', signal, 'POST', payload);
      allowed();
      if (!isObject(ack) || !Array.isArray(ack.ids) || ack.ids.length !== group.length || !group.every(row => (ack.ids as unknown[]).includes(row.id))) throw new Error('Invalid vector acknowledgement');
      db.transaction(tx => {
        allowed();
        for (const row of group) tx.update(reportVectors).set({ synced: true }).where(and(eq(reportVectors.id, row.id), eq(reportVectors.owner, owner))).run();
      });
      await pause(signal);
    }
    let cursor = db.select().from(reportSyncAccounts).where(eq(reportSyncAccounts.owner, owner)).get()?.cursor ?? '0';
    // Bound each pass. Committed page cursors allow the next trigger to continue.
    for (let page = 0; page < 10; page++) {
      allowed();
      const response = await request(getToken, `/reports?cursor=${cursor}`, signal);
      allowed();
      if (!isObject(response) || !Array.isArray(response.items) || response.items.length > 20 || !revision(response.cursor) || typeof response.hasMore !== 'boolean' || BigInt(response.cursor) < BigInt(cursor)) throw new Error('Invalid sync page');
      let previous = BigInt(cursor);
      const items = response.items.map((item: unknown) => {
        if (!isObject(item) || !revision(item.revision) || BigInt(item.revision) <= previous || BigInt(item.revision) > BigInt(response.cursor as string)) throw new Error('Invalid sync revision');
        previous = BigInt(item.revision);
        return { report: validateSyncedReport(item.report), revision: item.revision };
      });
      if (BigInt(response.cursor) !== previous || (response.hasMore && items.length === 0)) throw new Error('Invalid sync cursor');
      db.transaction(tx => {
        allowed();
        for (const item of items) restoreReport(tx, owner, item.report, item.revision);
        tx.update(reportSyncAccounts).set({ cursor: response.cursor as string, lastError: null }).where(eq(reportSyncAccounts.owner, owner)).run();
      });
      cursor = response.cursor;
      if (!response.hasMore) break;
      await pause(signal);
    }
  } catch (error) {
    if (!signal.aborted) {
      const db = await readyLocalDb();
      if (!signal.aborted) db.update(reportSyncAccounts).set({ lastError: error instanceof Error ? error.message : 'Cloud sync failed. Your reports are safe.' }).where(eq(reportSyncAccounts.owner, owner)).run();
    }
  } finally { if (flights.get(owner) === controller) flights.delete(owner); changed(); void scheduleReportIndexing(owner).catch(() => {}); }
}
type Db = Awaited<ReturnType<typeof readyLocalDb>>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
function restoreReport(tx: Tx, owner: string, report: SyncedReport, rev: string) {
  const existing = tx.select().from(localReports).where(eq(localReports.sessionId, report.id)).get();
  const session = tx.select().from(recordingSessions).where(eq(recordingSessions.id, report.id)).get();
  if ((existing && existing.ownerClerkId !== owner) || (session && session.ownerClerkId !== owner)) throw new Error('Local report ownership conflict');
  if (existing) {
    const canonical = validateSyncedReport({ id: existing.sessionId, title: existing.title, subject: existing.subject, grade: existing.grade, recordedAt: existing.recordedAt,
      durationMs: existing.durationMs, reportJson: existing.reportJson, classNotes: existing.classNotes, model: existing.model, createdAt: existing.createdAt });
    if (JSON.stringify(canonical) !== JSON.stringify(report)) throw new Error('Local and cloud report differ. Local copy retained.');
  } else {
    // Metadata-only parent retains the existing history FK; no microphone, audio or AI job is created.
    tx.insert(recordingSessions).values({ id: report.id, ownerClerkId: owner, title: report.title, subject: report.subject, grade: report.grade,
      startedAt: report.recordedAt, updatedAt: report.createdAt, durationMs: report.durationMs, expectedChunkCount: 0,
      status: 'complete', serverCreated: true, serverFinalized: true, error: null }).onConflictDoNothing().run();
    const row = { sessionId: report.id, ownerClerkId: owner, title: report.title, subject: report.subject, grade: report.grade,
      recordedAt: report.recordedAt, durationMs: report.durationMs, reportJson: report.reportJson, classNotes: report.classNotes, model: report.model, backend: ['gemma-3-270m-it-q8-v1@', 'gemma3-unsloth-q8@', 'gemma3-unsloth-qat-q8@', 'gemma3-ggml-q8@'].some(prefix => report.model.startsWith(prefix)) ? 'offline' as const : 'online' as const, createdAt: report.createdAt };
    tx.insert(localReports).values(row).run();
    addReportIndexSources(tx, row);
  }
  tx.insert(reportSyncAcks).values({ id: report.id, owner, revision: rev }).onConflictDoNothing().run();
}
function pause(signal: AbortSignal, milliseconds = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) throw new Error('Sync cancelled');
    const abort = () => { clearTimeout(timer); reject(new Error('Sync cancelled')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}
