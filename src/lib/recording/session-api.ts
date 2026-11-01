import { createOfflineEngine } from '@/lib/offline-stt/engine';
import { createDirectRecordingApi } from './direct-api';
import { RecordingApiError, type RecordingApi, type RecordingSession } from './types';

export function createSessionRecordingApi(owner: string): RecordingApi {
  const online = createDirectRecordingApi(owner);
  const offline = createOfflineEngine();
  function validate(session: RecordingSession): void {
    if (session.ownerClerkId !== owner || !['gnani', 'whisper'].includes(session.sttBackend)) {
      throw new RecordingApiError('Saved recording engine or owner is invalid.', false);
    }
  }
  return {
    async create(session, signal) {
      validate(session);
      if (session.sttBackend === 'whisper') await offline.prepare(session, signal);
      else await online.create(session, signal);
    },
    async transcribe(session, chunk, signal) {
      validate(session);
      if (chunk.sessionId !== session.id) throw new RecordingApiError('Recording segment belongs to another session.', false);
      return session.sttBackend === 'whisper' ? offline.transcribe(session, chunk, signal) : online.transcribe(session, chunk, signal);
    },
    async finalize(session, signal) {
      validate(session);
      if (session.sttBackend === 'gnani') await online.finalize(session, signal);
      await offline.dispose();
    },
    dispose: offline.dispose,
  };
}
