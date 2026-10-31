import type { VoiceInputStatus } from '@/types/chat';
import { useState } from 'react';

export function useVoiceInput() {
  const [error, setError] = useState<string | null>(null);
  return { status: 'idle' as VoiceInputStatus, error,
    startRecording: async () => { setError('Voice input is not connected yet. Type a message to keep a local draft.'); },
    stopRecording: async (): Promise<string | null> => null };
}
