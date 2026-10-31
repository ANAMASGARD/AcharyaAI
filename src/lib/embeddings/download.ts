import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { createDownloadResumable, type DownloadResumable } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type ModelModule = {
  downloadsAvailable: boolean; available: boolean;
  modelDownloaded(): Promise<boolean>; prepareDownload(): Promise<string>; finishDownload(): Promise<void>;
  discardDownload(): Promise<void>; removeModel(): Promise<void>;
};
const native = Platform.OS === 'android' && !isRunningInExpoGo() ? requireOptionalNativeModule<ModelModule>('AcharyaEmbeddings') : null;
export const MODEL_SIZE = 164626432;
export const MODEL_CARD = 'https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm';
const MODEL_URL = `${MODEL_CARD}/resolve/9be6e8b90982095dc05c2bd162e4b954ee4dbac7/embeddinggemma-2-text-270m.litertlm`;
export type ModelDownloadState = { status: 'missing' | 'checking' | 'downloading' | 'verifying' | 'downloaded' | 'error'; progress: number; error: string | null };
let state: ModelDownloadState = { status: 'checking', progress: 0, error: null };
let task: DownloadResumable | null = null;
let busy = false;
let cancelled = false;
const listeners = new Set<() => void>();
function update(next: Partial<ModelDownloadState>) { state = { ...state, ...next }; listeners.forEach((listener) => listener()); }
export const getModelDownloadState = () => state;
export const subscribeModelDownload = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const modelDownloadsAvailable = Boolean(native?.downloadsAvailable);
export const modelInferenceAvailable = Boolean(native?.available);
export async function checkModelDownload(): Promise<void> {
  if (busy || !native) { if (!native) update({ status: 'missing' }); return; }
  busy = true;
  try { update({ status: await native.modelDownloaded() ? 'downloaded' : 'missing', error: null }); }
  catch { update({ status: 'error', error: 'Could not check model storage. Try again.' }); }
  finally { busy = false; }
}
export async function downloadModel(): Promise<void> {
  if (busy || !native || state.status === 'downloaded') return;
  busy = true; cancelled = false;
  update({ status: 'downloading', progress: 0, error: null });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const uri = await native.prepareDownload();
    if (cancelled) return;
    task = createDownloadResumable(MODEL_URL, uri, {}, (progress) => {
      if (!cancelled) update({ progress: Math.min(progress.totalBytesWritten / MODEL_SIZE, 1) });
    });
    timer = setTimeout(() => { void cancelModelDownload(); }, 8 * 60 * 1000);
    const response = await task.downloadAsync();
    if (cancelled) return;
    if (response?.status !== 200) throw new Error('Download failed. Check your connection and retry.');
    update({ status: 'verifying' });
    await native.finishDownload();
    update({ status: 'downloaded', progress: 1 });
  } catch {
    if (!cancelled) update({ status: 'error', error: 'Download could not be verified or saved. Check your connection and free at least 230 MB, then retry.' });
  } finally {
    if (timer) clearTimeout(timer);
    task = null;
    try { await native.discardDownload(); } catch { update({ error: 'Could not remove the partial download. Retry when storage is available.' }); }
    if (cancelled) update({ status: 'missing', progress: 0 });
    busy = false;
  }
}
export async function cancelModelDownload(): Promise<void> {
  if (state.status !== 'downloading') return;
  cancelled = true;
  try { await task?.cancelAsync(); } catch { /* download finalizer reports storage errors */ }
}
export async function removeModelDownload(): Promise<void> {
  if (busy || !native) return;
  busy = true;
  try { await native.removeModel(); update({ status: 'missing', progress: 0, error: null }); }
  catch { update({ status: 'error', error: 'Could not remove the model. Try again.' }); }
  finally { busy = false; }
}
