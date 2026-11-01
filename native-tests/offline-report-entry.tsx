/** Isolated synthetic report gate. Never used by the normal app. */
import '../src/lib/entry-polyfills';
import { registerRootComponent } from 'expo';
import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { initLlama } from 'llama.rn';
import { runReportPipeline } from '../src/lib/offline-reports/pipeline';
import { reportNative } from '../src/lib/offline-reports/bridge';
import { withLocalReportEngine } from '../src/lib/offline-reports/engine';
const events: string[] = [];
function log(value: unknown) {
  const line = typeof value === 'string' ? value : JSON.stringify(value);
  events.push(line); console.info(`AcharyaReportGate ${line}`);
  new File(Paths.document, 'report-gate.json').write(JSON.stringify(events));
}
async function run() {
  const fixture = new File(Paths.document, 'gemma.gguf');
  if (!fixture.exists) { log('WAITING_FOR_MODEL'); return; }
  const transcript = 'Teacher: Today we learn fractions. One half plus one half equals one. Draw a circle and divide it into two equal parts. Student: Each part is one half.';
  const context = await initLlama({ model: fixture.uri, n_ctx: 4096, n_batch: 256, n_threads: 2, n_gpu_layers: 0, use_mmap: true });
  try {
    try {
      await runReportPipeline(transcript, { check() {}, progress: log, read: async () => null, write: async () => {},
        generate: async (prompt, schema, outputLimit) => {
          const result = await context.completion({ messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_schema', json_schema: { strict: true, schema: JSON.parse(schema) } },
            n_predict: outputLimit, temperature: 0, top_k: 1, enable_thinking: false });
          log({ baselineText: result.text.slice(0, 160), baselineContent: result.content?.slice(0, 160), stopped: result.stopped_limit });
          JSON.parse(result.content || result.text);
          return result.content || result.text;
        } });
      log('BASELINE_PASS');
    } catch (error) { log(`BASELINE_FAIL ${String(error)}`); }
  } finally { await context.release(); }
  const id = 'gemma3-unsloth-q8';
  if (!(await reportNative!.inspectReportModel(id)).downloaded) {
    const uri = await reportNative!.prepareReportDownload(id, true);
    const target = new File(uri); if (target.exists) await target.delete();
    await fixture.copy(target); await reportNative!.finishReportDownload(id);
  }
  for (const source of [transcript, 'आज हम भिन्न सीखेंगे। एक आधा और एक आधा मिलकर एक पूरा बनता है। Each part is one half.']) {
    const saved = new Map<string, string>();
    const result = await withLocalReportEngine('synthetic-report-gate', new AbortController().signal, async generate =>
      runReportPipeline(source, { generate, check() {}, progress: log, read: async key => saved.get(key) ?? null,
        write: async (key, value) => { saved.set(key, value); } }), id);
    log({ fixedReport: result.report, notes: result.classNotes, stages: saved.size });
  }
  log('FIXED_PIPELINE_PASS');
}
function App() {
  const [status, setStatus] = useState('Running synthetic local report checks');
  useEffect(() => { void run().then(() => setStatus(events.at(-1) ?? 'done')).catch(error => { log(`FAIL ${String(error)}`); setStatus(String(error)); }); }, []);
  return <View style={{ padding: 24 }}><Text>{status}</Text></View>;
}
registerRootComponent(App);
