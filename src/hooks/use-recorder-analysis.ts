import { useNetInfo } from '@react-native-community/netinfo';
import { readSavedReportResult, saveReportHistory } from '@/lib/reports/history';
import { usePreviewFeature, useUiPreferences } from '@/components/preview/preview-provider';
import type { ClassReportResult } from '@/lib/ai/class-report';
import { generateSavedClassReport, type ReportBackend } from '@/lib/reports/generate';
import { reportDownloads } from '@/lib/offline-reports/download';
import { reportModel, reportDownloadPublished } from '@/lib/offline-reports/model';
import { reportRuntimeAvailable } from '@/lib/offline-reports/bridge';
import { localReportBusy, subscribeLocalReport } from '@/lib/offline-reports/engine';
import { registerAiRequest } from '@/lib/ai/cancellation';
import type { RecordingSnapshot } from '@/lib/recording/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

type SavedReport = ClassReportResult & { owner: string; sessionId: string; transcript: string; createdAt: string };

export function useRecorderAnalysis(owner: string | null | undefined, snapshot: RecordingSnapshot | null, recorderBusy: boolean) {
  const prefs = useUiPreferences();
  const downloads = useSyncExternalStore(reportDownloads.subscribe, reportDownloads.getState, reportDownloads.getState);
  const nativeBusy = useSyncExternalStore(subscribeLocalReport, localReportBusy, () => false);
  const [override, setOverride] = useState<{ sessionId: string; backend: ReportBackend } | null>(null);
  const backend: ReportBackend = override && override.sessionId === snapshot?.session.id ? override.backend : snapshot?.session.sttBackend === 'whisper' ? 'offline' : 'online';
  const localReady = prefs.offlineReportsEnabled && reportRuntimeAvailable && reportDownloadPublished && downloads[reportModel(prefs.offlineReportModelId)?.id ?? '']?.status === 'downloaded';
  useFocusEffect(useCallback(() => { void reportDownloads.check(); }, []));
  const network = useNetInfo();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const [durable, setDurable] = useState<SavedReport | null>(null);
  const [saved, setSaved] = usePreviewFeature<SavedReport | null>('recorderAnalysis', null);
  const request = useRef<AbortController | null>(null);
  const unsaved = useRef<{ owner: string; sessionId: string; transcript: string; result: ClassReportResult } | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionId = snapshot?.session.id;
  const transcript = snapshot?.chunks.map((chunk) => chunk.status === 'done' ? chunk.transcript.trim() : '[inaudible]').join('\n\n') ?? '';
  const hasSpeech = snapshot?.chunks.some((chunk) => chunk.status === 'done' && chunk.transcript.trim());
  const ready = Boolean(owner && sessionId && snapshot?.session.ownerClerkId === owner && snapshot.session.serverFinalized &&
    ['complete', 'partial'].includes(snapshot.session.status) && !recorderBusy && hasSpeech &&
    snapshot.chunks.every((chunk) => chunk.status === 'done' || chunk.status === 'empty'));
  const preview = saved && saved.owner === owner && saved.sessionId === sessionId && saved.transcript === transcript ? saved : null;
  const result = durable && durable.owner === owner && durable.sessionId === sessionId && durable.transcript === transcript ? durable : preview;
  useFocusEffect(useCallback(() => {
    let active = true;
    if (owner && sessionId) void readSavedReportResult(owner, sessionId).then(value => {
      if (active && value) setDurable({ ...value, owner, sessionId, transcript, createdAt: new Date().toISOString() });
    }).catch(() => { if (active) setError('Could not open saved report. Reopen this class to retry.'); });
    return () => { active = false; };
  }, [owner, sessionId, transcript]));
  const cancel = useCallback(() => {
    const active = request.current;
    active?.abort();
    if (active) setPhase('Cancelling report…');
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => { if (next !== 'active') cancel(); });
    return () => { listener.remove(); cancel(); };
  }, [cancel, owner, sessionId]);
  useFocusEffect(useCallback(() => cancel, [cancel]));
  // Import the previously saved latest report into durable history without another AI request.
  useEffect(() => {
    if (!result || !snapshot || !owner) return;
    const controller = new AbortController();
    void saveReportHistory(owner, snapshot.session, result, controller.signal).catch(() => {
      if (!controller.signal.aborted) setError('Could not save this report to Calendar. Reopen the recorder to retry.');
    });
    return () => controller.abort();
  }, [owner, result, snapshot]);


  const send = async () => {
    if ((backend === 'online' ? offline : !localReady) || nativeBusy || !ready || !owner || !snapshot || request.current || result) return;
    const controller = new AbortController();
    request.current = controller;
    setError(null); setPhase(backend === 'offline' ? 'Loading Gemma…' : 'Analyzing your classroom…');
    const unregister = registerAiRequest(owner, controller);
    try {
      const pending = unsaved.current;
      const generated = pending?.owner === owner && pending.sessionId === sessionId && pending.transcript === transcript ? pending.result : await generateSavedClassReport(owner, snapshot.session.id, backend, { transcript, topic: snapshot.session.title,
        subject: snapshot.session.subject, classLevel: snapshot.session.grade }, controller.signal,
      (next) => { if (request.current === controller && !controller.signal.aborted) setPhase(next); }, prefs.offlineReportModelId);
      if (request.current !== controller || controller.signal.aborted) return;
      unsaved.current = { owner, sessionId: snapshot.session.id, transcript, result: generated };
      try { await saveReportHistory(owner, snapshot.session, generated, controller.signal); }
      catch { throw new Error('Report created but could not be saved. Tap Send to retry saving without generating again.'); }
      if (request.current !== controller || controller.signal.aborted) return;
      unsaved.current = null;
      setSaved({ ...generated, owner, sessionId: snapshot.session.id, transcript, createdAt: new Date().toISOString() });
    } catch (cause) {
      if (request.current === controller && !controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not generate the report. Tap Send to retry.');
      }
    } finally {
      unregister();
      if (request.current === controller) { request.current = null; setPhase(null); }
    }
  };
  const availabilityError = backend === 'offline'
    ? !reportDownloadPublished ? 'Gemma download is not published yet. Your transcript is saved.'
      : !localReady ? 'Download Gemma and enable offline reports in Run locally.' : null
    : offline ? 'Transcript saved. Connect to generate online, or select downloaded Gemma.' : null;
  return { report: result?.report ?? null, classNotes: result?.classNotes ?? null,
    backend, setBackend: (next: ReportBackend) => {
      if (!request.current && !nativeBusy && sessionId && !result) { setOverride({ sessionId, backend: next }); setError(null); unsaved.current = null; }
    },
    backendLocked: Boolean(phase || nativeBusy || result),
    isAnalyzing: phase !== null, canSend: ready && !availabilityError && !phase && !nativeBusy && !result, send, cancel,
    reportError: error ?? (ready && !result ? availabilityError : null), reportProgress: phase };
}
