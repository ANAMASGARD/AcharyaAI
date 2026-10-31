import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { microphoneLevel } from '@/lib/microphone-level';

/** PCM is reduced immediately to a level. No files, transcripts, or uploads. */
export function useMicrophoneLevel(enabled: boolean) {
  const latest = useRef({ level: 0, at: 0 });
  const [error, setError] = useState<string | null>(null);
  const accepting = useRef(false);
  const { stream, isStreaming } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'float32',
    onBuffer: ({ data }) => {
      if (accepting.current) latest.current = { level: microphoneLevel(new Float32Array(data)), at: Date.now() };
    },
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const stop = () => {
      accepting.current = false;
      latest.current = { level: 0, at: 0 };
      try { stream?.stop(); } catch { /* Native stream may already be released. */ }
    };
    const start = async () => {
      try {
        if (!stream) {
          setError('Microphone level detection is not available in this browser.');
          return;
        }
        const permission = await requestRecordingPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) {
          setError('Microphone access is off. Allow it in device settings to see voice levels.');
          return;
        }
        await stream.start();
        if (cancelled) { stop(); return; }
        accepting.current = true;
        setError(null);
      } catch {
        stop();
        if (!cancelled) setError('Could not start the microphone. Close and try again.');
      }
    };
    void start();
    return () => {
      cancelled = true;
      stop();
      // The native stream uses a recording session; restore tap sound playback.
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    };
  }, [enabled, stream]);

  return { latest, error, isStreaming: enabled && isStreaming };
}
