import { usePreviewFeature, useUiPreferences } from '@/components/preview/preview-provider';
import { backgroundCaptureAvailable, createNativeCapture } from '@/lib/recording/native-capture';
import { createId } from '@/lib/id';
import { createSessionRecordingApi } from '@/lib/recording/session-api';
import { offlineSttAvailable } from '@/lib/offline-stt/bridge';
import { sttModel } from '@/lib/offline-stt/models';
import { setRecorderMicrophoneActive } from '@/lib/recording/audio-focus';
import { RecorderController, type RecorderView } from '@/lib/recording/controller';
import { registerRecorder, waitForRecorderCleanup } from '@/lib/recording/lifecycle';
import { recordingRepository } from '@/lib/recording/repository';
import { useRecorderAnalysis } from '@/hooks/use-recorder-analysis';
import { useAuth } from '@clerk/expo';
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

type RecorderDraft = { topic: string; subject: string; classLevel: string };
const INITIAL: RecorderDraft = { topic: '', subject: '', classLevel: '' };
const EMPTY_VIEW: RecorderView = { snapshot: null, busy: false, error: null, hydrated: false };

export function useRecorder() {
  const preferences = useUiPreferences();
  const [draft, setDraft] = usePreviewFeature('recorder', INITIAL);
  const { userId } = useAuth();
  const controllerRef = useRef<RecorderController | null>(null);
  const captureEpoch = useRef(0);
  const [storedView, setView] = useState<RecorderView>(EMPTY_VIEW);
  const view = storedView.snapshot && storedView.snapshot.session.ownerClerkId !== userId ? EMPTY_VIEW : storedView;
  const [now, setNow] = useState(Date.now);
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: 'float32',
    onBuffer: (buffer) => controllerRef.current?.push(buffer) });
  const native = Platform.OS === 'android' || Platform.OS === 'ios';

  useEffect(() => {
    if (!native || !userId || !stream) return;
    let alive = true;
    const stop = () => {
      captureEpoch.current++;
      try { stream.stop(); } catch { /* Native capture may have already stopped. */ }
      setRecorderMicrophoneActive(false);
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    };
    const nativeCapture = createNativeCapture(userId, () => controller);
    const controller = new RecorderController(userId, recordingRepository,
      createSessionRecordingApi(userId), backgroundCaptureAvailable ? { ...nativeCapture,
        start: async () => {
          const permission = await requestRecordingPermissionsAsync();
          if (!permission.granted) throw new Error('Allow microphone access to record your class.');
          setRecorderMicrophoneActive(true);
          try { await nativeCapture.start(); } catch (error) { setRecorderMicrophoneActive(false); throw error; }
        },
        stop: async () => { try { await nativeCapture.stop(); } finally { setRecorderMicrophoneActive(false); } },
      } : {
        start: async () => {
          const epoch = ++captureEpoch.current;
          setRecorderMicrophoneActive(true);
          const permission = await requestRecordingPermissionsAsync();
          if (!alive || epoch !== captureEpoch.current) throw new Error('Recording start was cancelled.');
          if (!permission.granted) throw new Error('Microphone access is off. Allow it in device settings to record your class.');
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, allowsBackgroundRecording: false, interruptionMode: 'doNotMix' });
          if (!alive || epoch !== captureEpoch.current) throw new Error('Recording start was cancelled.');
          await stream.start();
        }, stop,
      }, createId);
    controllerRef.current = controller;
    const unregister = registerRecorder(userId, controller);
    const unsubscribe = controller.subscribe(() => { if (alive) setView(controller.getSnapshot()); });
    void waitForRecorderCleanup(userId).then(() => { if (alive) return controller.restore(); }).catch(() => {
      if (alive) setView({ ...EMPTY_VIEW, error: 'Could not finish closing the previous recording. Close and reopen Acharya to recover saved audio.' });
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (!backgroundCaptureAvailable && state !== 'active') void controller.stop('Recording stopped when the app left the foreground.');
    });
    return () => {
      alive = false;
      appState.remove(); unsubscribe();
      if (controllerRef.current === controller) controllerRef.current = null;
      unregister();
    };
  }, [native, userId, stream]);


  const snapshot = view.snapshot;
  const session = snapshot?.session;
  const chunks = snapshot?.chunks ?? [];
  const status = session?.status;
  const isRecording = status === 'recording';
  const isStarting = status === 'starting';
  const pending = chunks.filter((chunk) => chunk.status === 'pending' || chunk.status === 'processing').length;
  const failed = chunks.filter((chunk) => chunk.status === 'failed').length;
  const isTranscribing = status === 'stopping' || status === 'finishing' || pending > 0;
  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [isRecording]);
  const elapsed = isRecording && session ? Math.max(0, now - Date.parse(session.startedAt)) : session?.durationMs ?? 0;
  const seconds = Math.floor(elapsed / 1000);
  const mergedTranscript = chunks.map((chunk) => chunk.status === 'done' ? chunk.transcript.trim()
    : chunk.status === 'empty' ? '[inaudible]' : chunk.status === 'failed' ? `[Segment ${chunk.index + 1} failed — retry transcription]` : '')
    .filter(Boolean).join('\n\n');
  const analysis = useRecorderAnalysis(userId, snapshot, view.busy || isRecording || isStarting || isTranscribing);
  const canStartRecording = (!preferences.offlineSttEnabled || (offlineSttAvailable && Boolean(preferences.offlineSttModelId))) && !analysis.isAnalyzing && native && view.hydrated && !view.busy && !isRecording && !isStarting && !isTranscribing && !failed &&
    !(chunks.length && !session?.serverFinalized) && Boolean(draft.topic.trim() && draft.subject && draft.classLevel);
  let statusMessage = 'Fill topic, subject, and class to start';
  if (!native) statusMessage = 'Class recording is available on Android and iOS.';
  else if (!view.hydrated) statusMessage = 'Opening saved recording…';
  else if (isStarting) statusMessage = 'Starting microphone…';
  else if (isRecording) statusMessage = pending ? `Recording… (${pending} segment${pending === 1 ? '' : 's'} processing)` : 'Recording…';
  else if (isTranscribing) statusMessage = `Finishing transcription… (${pending} pending)`;
  else if (failed || status === 'partial') statusMessage = failed || !session?.serverFinalized ? 'Partial transcript — retry unfinished segments' : 'Recording stopped early · saved transcript';
  else if (status === 'complete') statusMessage = 'Transcription complete';
  else if (canStartRecording) statusMessage = '';
  const patch = (next: Partial<RecorderDraft>) => setDraft((current) => ({ ...current, ...next }));

  return {
    ...draft, isRecording, isStarting, isTranscribing,
    timerLabel: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    engineLabel: (session?.sttBackend ?? (preferences.offlineSttEnabled ? 'whisper' : 'gnani')) === 'whisper'
      ? `Offline · ${sttModel(session?.sttModelId ?? preferences.offlineSttModelId)?.label ?? 'Select a model in Run locally'}` : 'Online · Gnani',
    canNewClassroom: !analysis.isAnalyzing && !view.busy && !isRecording && !isStarting && !isTranscribing && Boolean(session?.serverFinalized) && !failed,
    canStartRecording, canSend: analysis.canSend, statusMessage, mergedTranscript,
    report: analysis.report, classNotes: analysis.classNotes,
    isAnalyzing: analysis.isAnalyzing, reportProgress: analysis.reportProgress, reportError: analysis.reportError, cancelAnalysis: analysis.cancel,
    analysisError: view.error ?? session?.error ?? (failed ? 'Some segments could not be transcribed. Their saved audio is retained for retry.' : null),
    canRetry: native && !isRecording && !isStarting && !isTranscribing && !view.busy && Boolean(failed || (session && !session.serverFinalized && chunks.length)),
    allowPartialSend: false,
    setTopic: (topic: string) => patch({ topic }), setSubject: (subject: string) => patch({ subject }),
    setClassLevel: (classLevel: string) => patch({ classLevel }),
    toggleRecording: () => {
      if (isRecording) void controllerRef.current?.stop();
      else if (canStartRecording) void controllerRef.current?.start({ title: draft.topic.trim(), subject: draft.subject, grade: draft.classLevel }, preferences.offlineSttEnabled
        ? { sttBackend: 'whisper', sttModelId: preferences.offlineSttModelId, sttLanguage: 'auto' }
        : { sttBackend: 'gnani', sttModelId: null, sttLanguage: 'en-IN' });
    },
    newClassroom: () => {
      if (analysis.isAnalyzing || !controllerRef.current?.prepareNewSession()) return false;
      setDraft(INITIAL);
      return true;
    },
    sendForAnalysis: analysis.send, confirmPartialSend: () => {},
    retryAnalysis: async () => { await controllerRef.current?.retry(); },
  };
}
