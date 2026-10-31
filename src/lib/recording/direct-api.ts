import { File } from 'expo-file-system';
import { getProviderCredential } from '@/lib/ai-keys/vault';
import { transcribeAudio } from '@/lib/ai/speech';
import { AiRequestError, checkAborted } from '@/lib/ai/transport';
import { RecordingApiError, type RecordingApi } from './types';

/** Session/chunk durability is on-device; only audio goes directly to Gnani. */
export function createDirectRecordingApi(owner: string): RecordingApi {
  return {
    async create(_session, signal) { checkAborted(signal); await getProviderCredential(owner, 'gnani'); checkAborted(signal); },
    async finalize(_session, signal) { checkAborted(signal); },
    async transcribe(chunk, signal) {
      try {
        if (!chunk.localUri) throw new RecordingApiError('Saved audio is missing for this segment', false);
        const audio = new File(chunk.localUri);
        if (!audio.exists) throw new RecordingApiError('Saved audio is missing for this segment', false);
        const transcript = await transcribeAudio(owner, audio, signal);
        return { chunkId: chunk.id, chunkIndex: chunk.index, transcript, status: transcript ? 'done' : 'empty' };
      } catch (error) {
        if (error instanceof RecordingApiError) throw error;
        if (error instanceof AiRequestError) throw new RecordingApiError(error.message, error.retryable, error.retryAfterMs);
        throw new RecordingApiError(error instanceof Error ? error.message : 'Could not transcribe this segment.', false);
      }
    },
  };
}
