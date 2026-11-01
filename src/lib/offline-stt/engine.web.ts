import type { createOfflineEngine as Create } from './engine';
export const createOfflineEngine: typeof Create = () => {
  const unavailable = async (): Promise<never> => { throw new Error('Offline speech needs the Android app build.'); };
  return { prepare: unavailable, transcribe: unavailable, dispose: async () => {} };
};
