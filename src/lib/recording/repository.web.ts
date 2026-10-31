import type { RecordingRepository } from './types';
const unavailable = async (): Promise<never> => { throw new Error('Recording is available on Android and iOS'); };
export const recordingRepository: RecordingRepository = {
  loadLatest: async () => null,
  saveSession: unavailable,
  saveChunk: unavailable,
  writeAudio: unavailable,
  deleteAudio: async () => {},
  clearAccount: async () => {},
};
