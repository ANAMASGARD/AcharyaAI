import { and, eq, isNull } from 'drizzle-orm';
import { readyLocalDb } from '@/db/ready';
import { localReports, recordingSessions, reportSyncAccounts, reportSyncAcks } from '@/db/schema';
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
  signal.throwIfAborted();
  if (!token) throw new Error('Sign in again to synchronize.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 20_000);
  try {
    const response = await fetch(`${base}${path}`, { method, signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(response.status === 409 ? 'A report conflicts with its cloud copy. Your local report is safe.' : `Cloud sync failed (${response.status}). Your local reports are safe.`);
    const value: unknown = await response.json();
    signal.throwIfAborted();
    return value;
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
    const allowed = () => { signal.throwIfAborted(); if (!db.select().from(reportSyncAccounts).where(eq(reportSyncAccounts.owner, owner)).get()?.enabled) throw new Error('Sync paused'); };
    if (!(await reportSyncStatus(owner))?.enabled) return;
    const pending = db.select({ report: localReports }).from(localReports).leftJoin(reportSyncAcks, and(eq(reportSyncAcks.id, localReports.sessionId), eq(reportSyncAcks.owner, owner)))
      .where(and(eq(localReports.ownerClerkId, owner), isNull(reportSyncAcks.id))).limit(20).all();
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
  } finally { if (flights.get(owner) === controller) flights.delete(owner); changed(); }
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
    tx.insert(localReports).values({ sessionId: report.id, ownerClerkId: owner, title: report.title, subject: report.subject, grade: report.grade,
      recordedAt: report.recordedAt, durationMs: report.durationMs, reportJson: report.reportJson, classNotes: report.classNotes, model: report.model, createdAt: report.createdAt }).run();
  }
  tx.insert(reportSyncAcks).values({ id: report.id, owner, revision: rev }).onConflictDoNothing().run();
}
function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(new Error('Sync cancelled')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 300);
    signal.addEventListener('abort', abort, { once: true });
  });
}
