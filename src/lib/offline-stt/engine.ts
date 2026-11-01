import { File } from 'expo-file-system';
import type { WhisperContext } from 'whisper.rn/index';
import { createId } from '@/lib/id';
import { RecordingApiError, type RecordingChunk, type RecordingSession, type SttChunkResponse } from '@/lib/recording/types';
import { offlineSttAvailable, sttNative } from './bridge';
import { sttModel } from './models';

function check(signal: AbortSignal): void {
  if (signal.aborted) throw new RecordingApiError('Local transcription cancelled. Saved audio is retained.', false);
}

/** One context per controller; the native reservation also excludes other controllers and LiteRT. */
export function createOfflineEngine() {
  let context: WhisperContext | null = null;
  let modelId: string | null = null;
  let token: string | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  function serial<T>(action: () => Promise<T>): Promise<T> {
    const next = tail.then(action); tail = next.catch(() => {}); return next;
  }
  async function release(): Promise<void> {
    if (context) { await context.release(); context = null; modelId = null; }
    if (token) { await sttNative!.releaseSttResidency(token); token = null; }
  }
  async function prepare(session: RecordingSession, signal: AbortSignal): Promise<void> {
    check(signal);
    if (!offlineSttAvailable) throw new RecordingApiError('Offline speech needs the updated Android app build.', false);
    const model = sttModel(session.sttModelId);
    if (!model || session.sttLanguage !== 'auto') throw new RecordingApiError('This saved speech model is unavailable. Open Run locally to repair it.', false);
    if (context && modelId === model.id) return;
    await release();
    const reservation = createId();
    await sttNative!.acquireSttResidency(reservation);
    token = reservation;
    try {
      check(signal);
      const filePath = await sttNative!.sttModelPath(model.id);
      check(signal);
      const { initWhisper } = await import('whisper.rn/index');
      context = await initWhisper({ filePath, useGpu: false });
      modelId = model.id;
      check(signal);
    } catch (error) {
      await release();
      throw new RecordingApiError(error instanceof Error ? error.message : 'Could not load the speech model. Try the small model.', false);
    }
  }
  return {
    prepare: (session: RecordingSession, signal: AbortSignal) => serial(() => prepare(session, signal)),
    transcribe: (session: RecordingSession, chunk: RecordingChunk, signal: AbortSignal): Promise<SttChunkResponse> => serial(async () => {
      await prepare(session, signal);
      if (!chunk.localUri || !new File(chunk.localUri).exists) throw new RecordingApiError('Saved audio is missing for this segment.', false);
      check(signal);
      const job = context!.transcribe(chunk.localUri, { language: session.sttLanguage, translate: false });
      let stopping: Promise<void> | null = null;
      const abort = () => { stopping ??= job.stop().catch(() => {}); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      try {
        const result = await job.promise;
        check(signal);
        if (result.isAborted) throw new RecordingApiError('Local transcription interrupted. Retry the saved segment.', false);
        const transcript = result.result.trim();
        return { chunkId: chunk.id, chunkIndex: chunk.index, transcript, status: transcript ? 'done' : 'empty', detectedLanguage: result.language || null };
      } finally {
        signal.removeEventListener('abort', abort);
        if (stopping) await stopping;
        // The original promise has settled before this operation leaves the serial queue.
      }
    }),
    dispose: () => serial(release),
  };
}
