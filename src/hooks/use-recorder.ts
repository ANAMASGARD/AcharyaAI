import { usePreviewFeature } from '@/components/preview/preview-provider';
import type { TeachingReport } from '@/types/recorder';
import { useEffect, useState } from 'react';

type RecorderDraft = { topic: string; subject: string; classLevel: string };
const INITIAL: RecorderDraft = { topic: '', subject: '', classLevel: '' };

/** This milestone previews controls only. No microphone, files, or processing jobs are started. */
export function useRecorder() {
  const [draft, setDraft] = usePreviewFeature('recorder', INITIAL);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isRecording = startedAt !== null;
  const seconds = startedAt === null ? elapsedSeconds : Math.max(0, Math.floor((now - startedAt) / 1000));
  useEffect(() => {
    if (startedAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [startedAt]);
  const patch = (next: Partial<RecorderDraft>) => setDraft((current) => ({ ...current, ...next }));
  const canStartRecording = Boolean(draft.topic.trim() && draft.subject && draft.classLevel);
  const toggleRecording = () => {
    if (startedAt !== null) {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      setStartedAt(null);
    } else if (canStartRecording) {
      const start = Date.now(); setNow(start); setStartedAt(start); setElapsedSeconds(0);
    }
  };
  return {
    ...draft, isRecording, isStarting: false, isTranscribing: false,
    timerLabel: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    canStartRecording, canSend: false,
    statusMessage: isRecording ? 'Timer preview running · microphone is off' : 'UI preview · microphone and class processing are not connected',
    mergedTranscript: '', report: null as TeachingReport | null, classNotes: null as string | null,
    analysisError: null as string | null, allowPartialSend: false,
    setTopic: (topic: string) => patch({ topic }), setSubject: (subject: string) => patch({ subject }),
    setClassLevel: (classLevel: string) => patch({ classLevel }), toggleRecording,
    sendForAnalysis: async () => {}, confirmPartialSend: () => {}, retryAnalysis: async () => {},
  };
}
