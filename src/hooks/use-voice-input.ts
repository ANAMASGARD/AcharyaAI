import type { VoiceInputStatus } from '@/types/chat';
import { useAuth } from '@clerk/expo';
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createId } from '@/lib/id';
import { getProviderCredential } from '@/lib/ai-keys/vault';
import { transcribeAudio } from '@/lib/ai/speech';
import { PcmChunker } from '@/lib/recording/pcm';
import { isRecorderMicrophoneActive, setRecorderMicrophoneActive } from '@/lib/recording/audio-focus';

/** Short voice message, capped at 30 seconds; classroom recordings use the durable recorder. */
export function useVoiceInput(onTranscript: (text: string) => void) {
  const { userId } = useAuth();
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const current = useRef<AbortController | null>(null);
  const capturing = useRef(false);
  const chunker = useRef<PcmChunker | null>(null);
  const audio = useRef<Uint8Array | null>(null);
  const limit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(onTranscript);
  useEffect(() => { done.current = onTranscript; }, [onTranscript]);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'float32', onBuffer: (buffer) => {
    if (!capturing.current || audio.current) return;
    try { chunker.current?.push(buffer); }
    catch { setError('Microphone format is unsupported. Try again with a different microphone.'); current.current?.abort(); void stopRef.current(); }
  } });
  const stopCapture = useCallback(() => {
    if (limit.current) clearTimeout(limit.current);
    limit.current = null;
    if (capturing.current) {
      capturing.current = false;
      try { stream?.stop(); } catch { /* Native stream may already be stopped. */ }
      setRecorderMicrophoneActive(false);
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
  }, [stream]);
  const cancel = useCallback(() => {
    current.current?.abort(); current.current = null;
    stopCapture(); chunker.current = null; audio.current = null; setStatus('idle');
  }, [stopCapture]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state !== 'active') cancel(); });
    return () => { listener.remove(); cancel(); };
  }, [cancel, userId]);
  useFocusEffect(useCallback(() => cancel, [cancel]));

  const stopRecording = useCallback(async (): Promise<void> => {
    const controller = current.current;
    if (!controller) return;
    if (!capturing.current) { cancel(); return; }
    stopCapture();
    if (!controller.signal.aborted) chunker.current?.flush();
    const wav = audio.current;
    chunker.current = null; audio.current = null;
    if (!wav || controller.signal.aborted || !userId) { cancel(); return; }
    setStatus('transcribing');
    let file: File | null = null;
    try {
      file = new File(Paths.cache, `acharya-voice-${createId()}.wav`);
      file.write(wav);
      const text = await transcribeAudio(userId, file, controller.signal);
      if (current.current === controller && !controller.signal.aborted) {
        if (text) done.current(text); else setError('No speech was recognized. Please try again.');
      }
    } catch (cause) {
      if (current.current === controller && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Voice transcription failed.');
    } finally {
      try { if (file?.exists) file.delete(); } catch { /* Cache can be purged by the OS. */ }
      if (current.current === controller) { current.current = null; setStatus('idle'); }
    }
  }, [cancel, stopCapture, userId]);
  useEffect(() => { stopRef.current = stopRecording; }, [stopRecording]);

  const startRecording = async (): Promise<void> => {
    if (current.current || !userId) return;
    if (Platform.OS === 'web') { setError('Voice input is available on Android and iOS.'); return; }
    if (isRecorderMicrophoneActive()) { setError('Stop the class recorder before recording a voice message.'); return; }
    const controller = new AbortController(); current.current = controller;
    setError(null); setStatus('recording');
    try {
      await getProviderCredential(userId, 'gnani');
      if (controller.signal.aborted) return;
      const permission = await requestRecordingPermissionsAsync();
      if (controller.signal.aborted) return;
      if (!permission.granted) throw new Error('Allow microphone access in device settings to use voice input.');
      capturing.current = true;
      setRecorderMicrophoneActive(true);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, allowsBackgroundRecording: false, interruptionMode: 'doNotMix' });
      if (controller.signal.aborted) return;
      chunker.current = new PcmChunker((wav) => {
        if (!audio.current) audio.current = wav;
        // Avoid re-entering the chunker during its native buffer callback.
        if (capturing.current) void Promise.resolve().then(() => stopRef.current());
      });
      await stream?.start();
      if (controller.signal.aborted) { try { stream?.stop(); } catch { /* Cancelled during native start. */ } return; }
      if (!capturing.current) return;
      limit.current = setTimeout(() => { void stopRef.current(); }, 30_000);
    } catch (cause) {
      if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Could not open microphone.'); cancel(); }
    }
  };
  return { status, error, startRecording, stopRecording, cancel };
}
