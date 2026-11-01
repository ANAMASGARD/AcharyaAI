import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { ModelStorage } from '@/lib/local-models/downloads';
import type { LlamaContext } from 'llama.rn';
type Bridge = {
  reportsAvailable: boolean;
  reportRuntime: string;
  inspectReportModel(id: string): ReturnType<ModelStorage['inspectSttModel']>;
  prepareReportDownload(id: string, restart: boolean): Promise<string>;
  finishReportDownload(id: string): Promise<void>;
  discardReportDownload(id: string): Promise<void>;
  removeReportModel(id: string): Promise<void>;
  openReportEngine(token: string, id: string): Promise<string>;
  cancelReportEngine(token: string): Promise<void>;
  closeReportEngine(token: string): Promise<void>;
};
const native = Platform.OS === 'android' && !isRunningInExpoGo()
  ? requireOptionalNativeModule<Bridge>('AcharyaEmbeddings') : null;
export const reportRuntimeAvailable = Boolean(native?.reportsAvailable && native.reportRuntime === 'gguf-v1');
let context: LlamaContext | null = null;
let activeToken: string | null = null;
export const reportNative = native ? {
  inspectReportModel: (id: string) => native.inspectReportModel(id),
  prepareReportDownload: (id: string, restart: boolean) => native.prepareReportDownload(id, restart),
  finishReportDownload: (id: string) => native.finishReportDownload(id),
  discardReportDownload: (id: string) => native.discardReportDownload(id),
  removeReportModel: (id: string) => native.removeReportModel(id),
  async openReportEngine(token: string, id?: string) {
    if (!id) throw new Error('Select a downloaded report model.');
    activeToken = token;
    const path = await native.openReportEngine(token, id);
    const { initLlama } = await import('llama.rn');
    context = await initLlama({ model: path, n_ctx: 4096, n_batch: 256, n_threads: 2, n_gpu_layers: 0, use_mmap: true });
  },
  async generateReportText(token: string, prompt: string, schema: string, outputLimit: number) {
    if (token !== activeToken || !context) throw new Error('Report model is not loaded.');
    const result = await context.completion({ messages: [{ role: 'user', content: prompt }],
      // Built-in Gemma formatting avoids Jinja channel/tool grammar overriding the JSON schema.
      jinja: false,
      response_format: { type: 'json_schema', json_schema: { strict: true, schema: JSON.parse(schema) as Record<string, unknown> } },
      n_predict: outputLimit, temperature: 0, top_k: 1, enable_thinking: false });
    if (result.interrupted || result.truncated || result.context_full || result.stopped_limit || result.tokens_predicted >= outputLimit)
      throw new Error('Report generation was interrupted or reached its limit. Your transcript is saved.');
    return result.content || result.text;
  },
  async cancelReportEngine(token: string) {
    await native.cancelReportEngine(token);
    if (activeToken === token) await context?.stopCompletion();
  },
  async closeReportEngine(token: string) {
    // The caller has already awaited loading/inference, including on cancellation.
    if (activeToken === token) {
      await context?.release(); context = null; activeToken = null;
    }
    await native.closeReportEngine(token);
  },
} : null;
