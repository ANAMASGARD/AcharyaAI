import { useNetInfo } from '@react-native-community/netinfo';
import { readSavedReportResult, saveReportHistory } from '@/lib/reports/history';
import { usePreviewFeature } from '@/components/preview/preview-provider';
import { generateClassReport, type ClassReportResult, type ReportPhase } from '@/lib/ai/class-report';
import type { RecordingSnapshot } from '@/lib/recording/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

type SavedReport = ClassReportResult & { owner: string; sessionId: string; transcript: string; createdAt: string };

export function useRecorderAnalysis(owner: string | null | undefined, snapshot: RecordingSnapshot | null, recorderBusy: boolean) {
  const network = useNetInfo();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const [durable, setDurable] = useState<SavedReport | null>(null);
  const [saved, setSaved] = usePreviewFeature<SavedReport | null>('recorderAnalysis', null);
  const request = useRef<AbortController | null>(null);
  const unsaved = useRef<{ owner: string; sessionId: string; transcript: string; result: ClassReportResult } | null>(null);
  const [phase, setPhase] = useState<ReportPhase | null>(null);
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
    request.current = null;
    active?.abort();
    setPhase(null);
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
    if (offline || !ready || !owner || !snapshot || request.current || result) return;
    const controller = new AbortController();
    request.current = controller;
    setError(null); setPhase('feedback');
    try {
      const pending = unsaved.current;
      const generated = pending?.owner === owner && pending.sessionId === sessionId && pending.transcript === transcript ? pending.result : await generateClassReport(owner, { transcript, topic: snapshot.session.title,
        subject: snapshot.session.subject, classLevel: snapshot.session.grade }, controller.signal,
      (next) => { if (request.current === controller && !controller.signal.aborted) setPhase(next); });
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
      if (request.current === controller) { request.current = null; setPhase(null); }
    }
  };
  return { report: result?.report ?? null, classNotes: result?.classNotes ?? null,
    isAnalyzing: phase !== null, canSend: ready && !offline && !phase && !result, send, cancel,
    reportError: error ?? (ready && offline && !result ? 'Transcript saved. Connect to the internet to generate a report.' : null), reportProgress: phase === 'feedback' ? 'Acharya AI is analyzing your classroom…' : phase === 'notes' ? 'Acharya AI is creating your class summary…' : null };
}
