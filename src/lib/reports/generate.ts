import * as Crypto from 'expo-crypto';
import { generateClassReport, type ClassReportInput, type ClassReportResult } from '@/lib/ai/class-report';
import { withLocalReportEngine } from '@/lib/offline-reports/engine';
import { runReportPipeline } from '@/lib/offline-reports/pipeline';
import { reportCheckpointStore } from '@/lib/offline-reports/checkpoints';
import { reportModel, REPORT_PROMPT_VERSION } from '@/lib/offline-reports/model';
export type ReportBackend = 'online' | 'offline';
export async function generateSavedClassReport(owner: string, sessionId: string, backend: ReportBackend, input: ClassReportInput,
  signal: AbortSignal, progress: (message: string) => void, modelId?: string | null): Promise<ClassReportResult> {
  if (backend === 'online') return generateClassReport(owner, input, signal,
    phase => progress(phase === 'feedback' ? 'Analyzing your classroom…' : 'Creating class notes…'));
  const model = reportModel(modelId);
  if (!model) throw new Error('Choose a downloaded report model in Run locally.');
  progress('Loading Gemma on this phone…');
  return withLocalReportEngine(owner, signal, async (generate, localSignal) => {
    const sourceHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(input));
    const fingerprint = `${model.revision}:${REPORT_PROMPT_VERSION}:${sourceHash}`;
    const store = await reportCheckpointStore(owner, sessionId, fingerprint, localSignal);
    const result = await runReportPipeline(input.transcript, { ...store, generate, progress,
      check: () => { if (localSignal.aborted) throw new Error('Report cancelled.'); } });
    return { ...result, model: `${model.id}@${model.revision}`, backend: 'offline', sourceHash, promptVersion: REPORT_PROMPT_VERSION };
  }, model.id);
}
