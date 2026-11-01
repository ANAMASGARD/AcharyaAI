import { createDownloadResumable, type DownloadResumable } from 'expo-file-system/legacy';
import storage from 'expo-sqlite/kv-store';
import { offlineSttAvailable, sttNative } from './bridge';
import { STT_MODELS, STT_REVISION, modelUrl, sttModel, type SttModelId } from './models';

type Status = 'checking' | 'missing' | 'downloading' | 'pausing' | 'paused' | 'verifying' | 'downloaded' | 'error';
export type DownloadState = { status: Status; progress: number; error: string | null };
type Checkpoint = { revision: string; modelId: SttModelId; uri: string; state: 'active' | 'paused'; offset?: number; resumeData?: string };
type Job = { intent: 'run' | 'pause' | 'cancel'; task: DownloadResumable | null; done: Promise<void>; control?: Promise<void> };
let states = Object.fromEntries(STT_MODELS.map(m => [m.id, { status: 'checking', progress: 0, error: null }])) as Record<SttModelId, DownloadState>;
const listeners = new Set<() => void>();
const jobs = new Map<SttModelId, Job>();
const key = (id: SttModelId) => `offline-stt-download:${id}`;
const save = (id: SttModelId, value: Checkpoint) => storage.setItemAsync(key(id), JSON.stringify(value));
function update(id: SttModelId, patch: Partial<DownloadState>) {
  states = { ...states, [id]: { ...states[id], ...patch } }; listeners.forEach(fn => fn());
}
export const getSttDownloads = () => states;
export const subscribeSttDownloads = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
async function checkpoint(id: SttModelId): Promise<Checkpoint | null> {
  try {
    const value: unknown = JSON.parse(await storage.getItemAsync(key(id)) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const item = value as Partial<Checkpoint>;
    return item.modelId === id && item.revision === STT_REVISION && typeof item.uri === 'string' &&
      (item.state === 'active' || item.state === 'paused') ? item as Checkpoint : null;
  } catch { return null; }
}
export function validPaused(item: Checkpoint | null, uri: string, bytes: number, expected: number): item is Checkpoint & { offset: number; resumeData: string } {
  return Boolean(item?.state === 'paused' && item.uri === uri && Number.isSafeInteger(item.offset) &&
    item.offset === bytes && bytes > 0 && bytes < expected && item.resumeData === String(bytes));
}
export function validRange(status: number, headers: Record<string, string>, offset: number, expected: number): boolean {
  const range = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-range')?.[1];
  return status === 206 && range === `bytes ${offset}-${expected - 1}/${expected}`;
}
export async function checkSttDownloads(): Promise<void> {
  for (const model of STT_MODELS) {
    if (jobs.has(model.id)) continue;
    if (!offlineSttAvailable) { update(model.id, { status: 'missing' }); continue; }
    // Reserve the model while inspecting/promoting so UI actions cannot race recovery.
    const job: Job = { intent: 'run', task: null, done: Promise.resolve() };
    jobs.set(model.id, job);
    job.done = (async () => {
      try {
        update(model.id, { status: 'checking' });
        const files = await sttNative!.inspectSttModel(model.id);
        if (files.downloaded) { await storage.removeItemAsync(key(model.id)); update(model.id, { status: 'downloaded', progress: 1, error: null }); return; }
        if (files.partialBytes === model.bytes) {
          await sttNative!.finishSttDownload(model.id);
          await storage.removeItemAsync(key(model.id));
          update(model.id, { status: 'downloaded', progress: 1, error: null }); return;
        }
        const saved = await checkpoint(model.id);
        const paused = validPaused(saved, files.uri, files.partialBytes, model.bytes);
        update(model.id, { status: paused ? 'paused' : 'missing', progress: paused ? files.partialBytes / model.bytes : 0,
          error: files.partialBytes && !paused ? 'Download interrupted. Retry starts a fresh download.' : null });
      } catch (error) { update(model.id, { status: 'error', error: message(error) }); }
      finally { jobs.delete(model.id); }
    })();
    await job.done;
  }
}

export async function downloadSttModel(id: SttModelId): Promise<void> {
  if (!offlineSttAvailable || jobs.size || states[id].status === 'downloaded') return;
  const model = sttModel(id)!;
  const job: Job = { intent: 'run', task: null, done: Promise.resolve() };
  jobs.set(id, job);
  job.done = (async () => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let stalled = false;
    try {
      const files = await sttNative!.inspectSttModel(id);
      const saved = await checkpoint(id);
      const resume = validPaused(saved, files.uri, files.partialBytes, model.bytes) ? saved : null;
      const uri = await sttNative!.prepareSttDownload(id, !resume);
      if (job.intent !== 'run') return;
      await save(id, { modelId: id, revision: STT_REVISION, uri, state: 'active' });
      update(id, { status: 'downloading', progress: (resume?.offset ?? 0) / model.bytes, error: null });
      let progressed = Date.now(); let previous = resume?.offset ?? 0;
      job.task = createDownloadResumable(modelUrl(id), uri, {}, progress => {
        if (progress.totalBytesWritten > previous) { progressed = Date.now(); previous = progress.totalBytesWritten; }
        if (job.intent === 'run') update(id, { progress: Math.min(previous / model.bytes, 1) });
      }, resume?.resumeData);
      timer = setInterval(() => {
        if (job.intent === 'run' && Date.now() - progressed > 60_000) {
          stalled = true; void job.task?.cancelAsync().catch(() => {});
        }
      }, 5000);
      const result = await (resume ? job.task.resumeAsync() : job.task.downloadAsync());
      if (timer) clearInterval(timer);
      if (job.intent !== 'run') return;
      if (stalled) throw new Error('Download stalled. Retry when your connection is stable.');
      if (!result || (resume ? !validRange(result.status, result.headers, resume.offset, model.bytes) : result.status !== 200)) {
        throw new Error('The download could not resume safely. Retry starts a fresh download.');
      }
      update(id, { status: 'verifying' });
      await sttNative!.finishSttDownload(id);
      await storage.removeItemAsync(key(id));
      update(id, { status: 'downloaded', progress: 1, error: null });
    } catch (error) {
      if (job.intent === 'run') {
        await sttNative!.discardSttDownload(id).catch(() => {});
        await storage.removeItemAsync(key(id));
        update(id, { status: 'error', error: stalled ? 'Download stalled. Retry when connected.' : message(error) });
      }
    } finally {
      if (timer) clearInterval(timer);
      if (job.intent === 'run') jobs.delete(id);
    }
  })();
  await job.done;
}

export async function pauseSttDownload(id: SttModelId): Promise<void> {
  const job = jobs.get(id);
  if (!job?.task || job.intent !== 'run' || states[id].status !== 'downloading') return;
  job.intent = 'pause'; update(id, { status: 'pausing' });
  job.control = (async () => {
    try {
      const snapshot = await job.task!.pauseAsync();
      await job.done;
      const files = await sttNative!.inspectSttModel(id);
      const value: Checkpoint = { revision: STT_REVISION, modelId: id, uri: snapshot.fileUri, state: 'paused',
        resumeData: snapshot.resumeData, offset: Number(snapshot.resumeData) };
      if (!validPaused(value, files.uri, files.partialBytes, sttModel(id)!.bytes)) throw new Error('Could not save a safe pause point. Retry starts a fresh download.');
      if (job.intent !== 'pause') return;
      await save(id, value);
      update(id, { status: 'paused', error: null });
    } catch (error) {
      // A failed Pause is not proof that the native transfer stopped writing.
      await job.task!.cancelAsync().catch(() => {});
      await job.done;
      if (job.intent === 'pause') update(id, { status: 'error', error: message(error) });
    } finally { if (job.intent === 'pause') jobs.delete(id); }
  })();
  await job.control;
}
export async function cancelSttDownload(id: SttModelId): Promise<void> {
  if (states[id].status === 'downloaded') return;
  const job = jobs.get(id);
  if (job && ['checking', 'verifying'].includes(states[id].status)) return;
  if (job) {
    job.intent = 'cancel';
    await job.task?.cancelAsync().catch(() => {});
    await job.done; await job.control;
  }
  try {
    await sttNative?.discardSttDownload(id); await storage.removeItemAsync(key(id));
    update(id, { status: 'missing', progress: 0, error: null });
  } catch (error) { update(id, { status: 'error', error: message(error) }); }
  finally { jobs.delete(id); }
}
export async function removeSttModel(id: SttModelId): Promise<boolean> {
  if (jobs.size) return false;
  const job: Job = { intent: 'run', task: null, done: Promise.resolve() }; jobs.set(id, job);
  try {
    await sttNative?.removeSttModel(id); update(id, { status: 'missing', progress: 0, error: null }); return true;
  } catch (error) { update(id, { error: message(error) }); return false; }
  finally { jobs.delete(id); }
}
function message(error: unknown): string { return error instanceof Error ? error.message : 'Model storage is unavailable. Retry when storage and network are available.'; }
