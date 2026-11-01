const { Buffer } = require('node:buffer');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, AbortController, Error, Promise, require: name => name in mocks ? mocks[name] : require(name) });
  return exports;
}
const json = load('src/lib/offline-reports/json.ts');
const pipeline = load('src/lib/offline-reports/pipeline.ts', { './json': json });
test('long multilingual transcript windows preserve every character and bounded UTF-8 inputs', () => {
  const source = 'नमस्ते कक्षा। Hindi and English 🙂. '.repeat(1200);
  const windows = pipeline.transcriptWindows(source);
  assert.equal(windows.map(w => w.text).join(''), source);
  for (const window of windows) {
    assert.ok(Buffer.byteLength(window.text) <= 1400);
    assert.equal(source.slice(window.start, window.end), window.text);
  }
  assert.equal(windows.at(-1).end, source.length);
});
test('fabricated, empty and oversized evidence is rejected', () => {
  for (const value of [{ summary: 'Good class', quote: 'invented' }, { summary: '', quote: 'lesson' }, { summary: 'अ'.repeat(300), quote: 'lesson' }]) {
    assert.throws(() => pipeline.parseDigest(JSON.stringify(value), ['lesson'], ['part-1']));
  }
});
test('pipeline covers every section, reuses validated checkpoints, and retains partial work on interruption', async () => {
  const source = 'lesson '.repeat(600); const saved = new Map(); let requests = 0; let aborted = false;
  const io = {
    read: async key => saved.get(key) ?? null, write: async (key, value) => saved.set(key, value),
    progress: () => {}, check: () => { if (aborted) throw Error('cancelled'); },
    generate: async (prompt, schema) => {
      requests++; assert.ok(Buffer.byteLength(prompt) <= 2800);
      if (schema.includes('overallScore')) return JSON.stringify({ classroomEnvironment: 'Not observed', whatWentWrong: 'Insufficient evidence', areasToImprove: 'Consider examples', topicSpecificFeedback: 'Lesson covered', overallScore: 50, quote: 'lesson' });
      return JSON.stringify({ summary: 'lesson content', quote: 'lesson' });
    },
  };
  const first = await pipeline.runReportPipeline(source, io);
  assert.equal((first.classNotes.match(/## Section/g) || []).length, pipeline.transcriptWindows(source).length);
  assert.match(first.report.topicSpecificFeedback, /Evidence/);
  const calls = requests;
  const second = await pipeline.runReportPipeline(source, io);
  assert.equal(requests, calls); assert.equal(second.classNotes, first.classNotes);
  aborted = true; await assert.rejects(pipeline.runReportPipeline(source, io), /cancelled/);
  assert.ok(saved.size > 0);
});
test('corrupt cached results never bypass validation', async () => {
  await assert.rejects(pipeline.runReportPipeline('lesson', { read: async () => '{"summary":"fake","quote":"invented"}', write: async () => {}, generate: async () => { throw Error('should not run'); }, progress: () => {}, check: () => {} }), /quotation/);
});
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test('local cancellation waits for original inference before closing and releases app exclusion', async () => {
  const inference = deferred(); const events = [];
  const engine = load('src/lib/offline-reports/engine.ts', {
    '@/lib/id': { createId: () => 'token' }, './model': { reportDownloadPublished: true },
    './bridge': { reportRuntimeAvailable: true, reportNative: {
      openReportEngine: async () => events.push('open'), generateReportText: async () => { events.push('generate'); return inference.promise; },
      cancelReportEngine: async () => events.push('cancel'), closeReportEngine: async () => events.push('close'),
    } },
  });
  const controller = new AbortController();
  const running = engine.withLocalReportEngine('alice', controller.signal, generate => generate('prompt', '{}', 100));
  await tick(); const rejected = assert.rejects(running, /cancelled/); controller.abort(); await tick();
  assert.equal(engine.localReportBusy(), true); assert.deepEqual(events, ['open', 'generate', 'cancel']);
  await assert.rejects(engine.withLocalReportEngine('bob', new AbortController().signal, async () => ''), /Another report/);
  inference.resolve('stale'); await rejected;
  assert.deepEqual(events, ['open', 'generate', 'cancel', 'close']); assert.equal(engine.localReportBusy(), false);
});
test('unpublished model blocks native inference', async () => {
  const engine = load('src/lib/offline-reports/engine.ts', { '@/lib/id': {}, './model': { reportDownloadPublished: false }, './bridge': { reportRuntimeAvailable: true } });
  await assert.rejects(engine.withLocalReportEngine('alice', new AbortController().signal, async () => ''), /not available/);
});
test('offline dispatcher never calls online report generation and records immutable model provenance', async () => {
  let online = 0; let local = 0;
  const service = load('src/lib/reports/generate.ts', {
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async () => 'source-hash' },
    '@/lib/ai/class-report': { generateClassReport: async () => { online++; return {}; } },
    '@/lib/offline-reports/engine': { withLocalReportEngine: async (owner, signal, run) => { assert.equal(owner, 'alice'); local++; return run(async () => '', signal); } },
    '@/lib/offline-reports/pipeline': { runReportPipeline: async () => ({ report: {}, classNotes: 'notes' }) },
    '@/lib/offline-reports/checkpoints': { reportCheckpointStore: async () => ({ read: async () => null, write: async () => {} }) },
    '@/lib/offline-reports/model': { reportModel: id => id === 'gemma' ? { id: 'gemma', revision: 'fixed' } : undefined, REPORT_PROMPT_VERSION: 'v1' },
  });
  const result = await service.generateSavedClassReport('alice', 'session', 'offline', { transcript: 'lesson' }, new AbortController().signal, () => {}, 'gemma');
  assert.equal(online, 0); assert.equal(local, 1); assert.equal(result.model, 'gemma@fixed'); assert.equal(result.backend, 'offline');
});
test('three report artifacts have independent pinned identities and safe download paths', () => {
  const models = JSON.parse(fs.readFileSync('assets/models/gemma-report.json', 'utf8'));
  assert.equal(models.length, 3);
  assert.equal(new Set(models.map(model => model.id)).size, 3);
  assert.equal(new Set(models.map(model => model.filename)).size, 3);
  for (const model of models) {
    assert.match(model.sha256, /^[a-f0-9]{64}$/);
    assert.ok(model.url.includes(`/resolve/${model.revision}/`));
    assert.match(model.filename, /^[a-z0-9-]+\.gguf$/);
    assert.ok(model.bytes > 250_000_000 && model.bytes < 500_000_000);
  }
});
test('GGUF bridge retains native reservation until context release finishes', async () => {
  const release = deferred(); const events = [];
  const native = { reportsAvailable: true, reportRuntime: 'gguf-v1',
    openReportEngine: async (token, id) => { events.push(['reserve', id]); return '/verified.gguf'; },
    cancelReportEngine: async () => events.push('cancel-native'), closeReportEngine: async () => events.push('unreserve') };
  const bridge = load('src/lib/offline-reports/bridge.ts', {
    expo: { isRunningInExpoGo: () => false, requireOptionalNativeModule: () => native },
    'react-native': { Platform: { OS: 'android' } },
    'llama.rn': { initLlama: async config => { assert.equal(config.n_ctx, 4096); return {
      stopCompletion: async () => events.push('stop'), release: async () => { events.push('release'); await release.promise; },
      completion: async params => { assert.equal(params.jinja, false); assert.equal(params.response_format.type, 'json_schema'); return { text: '{}', interrupted: false, truncated: false, context_full: false, stopped_limit: 0, tokens_predicted: 2 }; },
    }; } },
  });
  await bridge.reportNative.openReportEngine('token', 'gemma3-ggml-q8');
  assert.equal(await bridge.reportNative.generateReportText('token', 'prompt', '{}', 100), '{}');
  await bridge.reportNative.cancelReportEngine('token');
  const closing = bridge.reportNative.closeReportEngine('token'); await tick();
  assert.deepEqual(events, [['reserve', 'gemma3-ggml-q8'], 'cancel-native', 'stop', 'release']);
  release.resolve(); await closing; assert.equal(events.at(-1), 'unreserve');
});

test('local JSON accepts exact model framing but rejects HTML, truncation and extra prose', () => {
  for (const raw of ['{"summary":"lesson"}', '```json\n{"summary":"lesson"}\n```', '<start_of_turn>model\n{"summary":"lesson"}<end_of_turn>', '<start_of_turn>model\n```json\n{"summary":"lesson"}\n```<end_of_turn><eos>']) {
    assert.equal(json.parseReportJson(raw).summary, 'lesson');
  }
  for (const raw of ['<html>{"summary":"lesson"}</html>', '{"summary":', '{"summary":"lesson"} extra', 'Here is {"summary":"lesson"}']) {
    assert.throws(() => json.parseReportJson(raw), /invalid report format/);
  }
});
