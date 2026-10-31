import { useAuth } from '@clerk/expo';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createId } from '@/lib/id';
import { synthesizeSpeech } from '@/lib/ai/speech';
import { isRecorderMicrophoneActive, subscribeRecorderMicrophone } from '@/lib/recording/audio-focus';
import type { VoiceOutputStatus } from '@/types/chat';

export function useVoiceOutput() {
  const { userId } = useAuth();
  const [status, setStatus] = useState<VoiceOutputStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const player = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const file = useRef<File | null>(null);
  const stop = useCallback(() => {
    request.current?.abort(); request.current = null;
    try { player.current?.remove(); } catch { /* Audio session may have ended. */ }
    player.current = null;
    try { if (file.current?.exists) file.current.delete(); } catch { /* OS may have purged cache. */ }
    file.current = null;
    setStatus('idle');
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => { if (next !== 'active') stop(); });
    const unsubscribe = subscribeRecorderMicrophone(() => { if (isRecorderMicrophoneActive()) stop(); });
    return () => { listener.remove(); unsubscribe(); stop(); };
  }, [stop, userId]);
  useFocusEffect(useCallback(() => stop, [stop]));
  const speak = async (text: string): Promise<void> => {
    if (!userId || request.current) return;
    if (Platform.OS === 'web') { setError('Read aloud is available on Android and iOS.'); return; }
    if (isRecorderMicrophoneActive()) { setError('Stop recording before using read aloud.'); return; }
    const controller = new AbortController(); request.current = controller;
    setError(null); setStatus('loading');
    try {
      const wav = await synthesizeSpeech(userId, text, controller.signal);
      if (controller.signal.aborted) return;
      file.current = new File(Paths.cache, `acharya-speech-${createId()}.wav`);
      file.current.writeSync(wav);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      if (controller.signal.aborted || isRecorderMicrophoneActive()) { stop(); return; }
      const audio = createAudioPlayer({ uri: file.current.uri });
      player.current = audio;
      audio.addListener('playbackStatusUpdate', (next) => { if (next.didJustFinish && player.current === audio) stop(); });
      audio.play(); setStatus('speaking');
    } catch (cause) {
      if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Could not read this message aloud.'); stop(); }
    }
  };
  return { status, error, speak, stop };
}
