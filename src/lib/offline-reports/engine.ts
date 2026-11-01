import { createId } from '@/lib/id';
import { reportNative, reportRuntimeAvailable } from './bridge';
import { reportDownloadPublished } from './model';
const active = new Map<string, { controller: AbortController; done: Promise<unknown> }>();
const listeners = new Set<() => void>();
export const localReportBusy = () => active.size > 0;
export const subscribeLocalReport = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export async function stopLocalReports(owner: string): Promise<void> {
  const job = active.get(owner); job?.controller.abort(); await job?.done.catch(() => {});
}
export async function withLocalReportEngine<T>(owner: string, signal: AbortSignal,
  operation: (generate: (prompt: string, schema: string, outputLimit: number) => Promise<string>, signal: AbortSignal) => Promise<T>, modelId?: string): Promise<T> {
  if (active.size) throw new Error('Another report is still running. Wait for it to finish or cancel.');
  if (!reportRuntimeAvailable || !reportDownloadPublished) throw new Error('Gemma download is not available in this build yet. Your transcript is saved.');
  const controller = new AbortController();
  const token = createId();
  let cancellation: Promise<void> | undefined;
  const cancel = () => { controller.abort(); cancellation ??= reportNative!.cancelReportEngine(token).catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const job = { controller, done: Promise.resolve<unknown>(undefined) };
  active.set(owner, job);
  const check = () => { if (controller.signal.aborted) throw new Error('Report cancelled. Saved transcript and progress are retained.'); };
  controller.signal.addEventListener('abort', () => { cancellation ??= reportNative!.cancelReportEngine(token).catch(() => {}); }, { once: true });
  job.done = (async () => {
    try {
      if (signal.aborted) cancel(); check();
      await reportNative!.openReportEngine(token, modelId); check();
      return await operation(async (prompt, schema, limit) => {
        check(); const value = await reportNative!.generateReportText(token, prompt, schema, limit); check(); return value;
      }, controller.signal);
    } finally {
      signal.removeEventListener('abort', cancel);
      if (cancellation) await cancellation;
      try { await reportNative!.closeReportEngine(token); }
      finally { active.delete(owner); listeners.forEach(fn => fn()); }
    }
  })();
  listeners.forEach(fn => fn());
  return job.done as Promise<T>;
}
