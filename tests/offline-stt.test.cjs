const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    { exports, AbortController, Error, Date, Promise, setInterval, clearInterval, require: name => { assert.ok(name in mocks, name); return mocks[name]; } });
  return exports;
}
const models = load('src/lib/offline-stt/models.ts');
const types = load('src/lib/recording/types.ts');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
function engineHarness() {
  const events = []; let job; let loading;
  const context = {
    transcribe(path, options) { events.push(['transcribe', path, options]); job = deferred(); return { promise: job.promise, stop: async () => events.push(['stop']) }; },
    release: async () => events.push(['release']),
  };
  const native = {
    acquireSttResidency: async () => events.push(['reserve']),
    releaseSttResidency: async () => events.push(['unreserve']),
    sttModelPath: async () => '/models/small.bin',
  };
  const mod = load('src/lib/offline-stt/engine.ts', {
    'expo-file-system': { File: class { exists = true; } }, '@/lib/id': { createId: () => 'reservation' },
    '@/lib/recording/types': types, './bridge': { offlineSttAvailable: true, sttNative: native }, './models': models,
    'whisper.rn/index': { initWhisper: async () => { events.push(['load']); if (loading) await loading.promise; return context; } },
  });
  return { engine: mod.createOfflineEngine(), events, finish: value => job.resolve(value), delayLoad: () => loading = deferred() };
}
const session = { id: 's', ownerClerkId: 'alice', sttBackend: 'whisper', sttModelId: models.STT_MODELS[0].id, sttLanguage: 'auto' };
const chunk = { id: 'c', sessionId: 's', index: 0, localUri: 'file:///chunk.wav' };
test('offline inference reuses one context, passes local WAVs and preserves requested versus detected language', async () => {
  const h = engineHarness(); const signal = new AbortController().signal;
  await h.engine.prepare(session, signal);
  const first = h.engine.transcribe(session, chunk, signal); await tick();
  h.finish({ result: ' नमस्ते ', language: 'hi', isAborted: false });
  const result = await first; assert.equal(result.transcript, 'नमस्ते'); assert.equal(result.detectedLanguage, 'hi'); assert.equal(session.sttLanguage, 'auto');
  const second = h.engine.transcribe(session, { ...chunk, index: 1 }, signal); await tick();
  h.finish({ result: ' ', language: 'en', isAborted: false }); assert.equal((await second).status, 'empty');
  assert.equal(h.events.filter(e => e[0] === 'load').length, 1);
  assert.equal(h.events[2][2].translate, false);
  await h.engine.dispose(); assert.deepEqual(h.events.slice(-2).map(e => e[0]), ['release', 'unreserve']);
});
test('abort requests stop but waits for original settlement before release; late results never succeed', async () => {
  const h = engineHarness(); const abort = new AbortController();
  const operation = h.engine.transcribe(session, chunk, abort.signal); await tick();
  abort.abort(); const rejected = assert.rejects(operation, /cancelled/);
  const disposing = h.engine.dispose(); await tick();
  assert.ok(h.events.some(e => e[0] === 'stop')); assert.ok(!h.events.some(e => e[0] === 'release'));
  h.finish({ result: 'late text', language: 'en', isAborted: false }); await rejected; await disposing;
  assert.deepEqual(h.events.slice(-2).map(e => e[0]), ['release', 'unreserve']);
});
test('cancellation during load releases initialized model without transcription', async () => {
  const h = engineHarness(); const loading = h.delayLoad(); const abort = new AbortController();
  const pending = h.engine.prepare(session, abort.signal); await tick(); abort.abort(); loading.resolve();
  await assert.rejects(pending, /cancelled/); assert.ok(!h.events.some(e => e[0] === 'transcribe'));
  assert.deepEqual(h.events.slice(-2).map(e => e[0]), ['release', 'unreserve']);
});
test('native isAborted is a failure even without an aborted application signal', async () => {
  const h = engineHarness(); const pending = h.engine.transcribe(session, chunk, new AbortController().signal); await tick();
  h.finish({ result: 'partial', language: 'en', isAborted: true }); await assert.rejects(pending, /interrupted/); await h.engine.dispose();
});
test('dispatcher routes from saved session and never consults online credentials for offline work', async () => {
  let onlineCalls = 0; const offline = [];
  const mod = load('src/lib/recording/session-api.ts', {
    './types': types, './direct-api': { createDirectRecordingApi: () => ({ create: async () => onlineCalls++, transcribe: async () => onlineCalls++, finalize: async () => onlineCalls++ }) },
    '@/lib/offline-stt/engine': { createOfflineEngine: () => ({ prepare: async s => offline.push(s.sttModelId), transcribe: async s => { offline.push(s.sttModelId); return { status: 'empty' }; }, dispose: async () => {} }) },
  });
  const api = mod.createSessionRecordingApi('alice'); const signal = new AbortController().signal;
  // Recovery may call transcribe without ever calling create.
  await api.transcribe(session, chunk, signal); await api.create(session, signal); await api.finalize(session, signal);
  assert.equal(onlineCalls, 0); assert.deepEqual(offline, [session.sttModelId, session.sttModelId]);
  await assert.rejects(api.transcribe({ ...session, ownerClerkId: 'bob' }, chunk, signal), /owner/);
  await assert.rejects(api.transcribe(session, { ...chunk, sessionId: 'other' }, signal), /another session/);
});
function downloadsHarness({ paused = false, kill = false, completed = false, range = true, pauseFailure = false, cancelGate = null } = {}) {
  const model = models.STT_MODELS[0]; const values = new Map(); const events = []; let size = completed ? model.bytes : paused || kill ? 20 : 0;
  let verified = false; let transfer;
  if (paused || kill) values.set(`offline-stt-download:${model.id}`, JSON.stringify({ revision: models.STT_REVISION, modelId: model.id, uri: 'file:///model.part', state: kill ? 'active' : 'paused', offset: 20, resumeData: '20' }));
  const native = {
    inspectSttModel: async id => ({ downloaded: id === model.id && verified, partialBytes: id === model.id ? size : 0, uri: 'file:///model.part' }),
    prepareSttDownload: async (_, restart) => { events.push(['prepare', restart]); if (restart) size = 0; return 'file:///model.part'; },
    finishSttDownload: async () => { events.push(['verify']); assert.equal(size, model.bytes); verified = true; },
    discardSttDownload: async () => { size = 0; events.push(['discard']); },
    removeSttModel: async () => { throw new Error('Saved transcription needs this model'); },
  };
  const manager = load('src/lib/local-models/downloads.ts', {
    'expo-sqlite/kv-store': { getItemAsync: async k => values.get(k) ?? null, setItemAsync: async (k, v) => values.set(k, v), removeItemAsync: async k => values.delete(k) },
    'expo-file-system/legacy': { createDownloadResumable: (_, uri, options, progress, resumeData) => {
      const run = () => { transfer = deferred(); return transfer.promise; };
      return { downloadAsync: run, resumeAsync: run,
        pauseAsync: async () => { if (pauseFailure) throw new Error('Native pause failed'); size = 40; transfer.resolve(undefined); return { fileUri: uri, resumeData: '40' }; },
        cancelAsync: async () => { if (cancelGate) await cancelGate.promise; transfer?.resolve(undefined); },
      };
    } },
  });
  const mod = load('src/lib/offline-stt/download.ts', { './models': models, './bridge': { offlineSttAvailable: true, sttNative: native }, '@/lib/local-models/downloads': manager });
  return { mod, id: model.id, events, values, finish: () => { size = model.bytes; transfer.resolve({ status: paused ? (range ? 206 : 200) : 200, headers: paused ? { 'Content-Range': `bytes 20-${model.bytes - 1}/${model.bytes}` } : {} }); } };
}
test('paused model resumes only validated checkpoint and promotes after verification', async () => {
  const h = downloadsHarness({ paused: true }); await h.mod.checkSttDownloads(); assert.equal(h.mod.getSttDownloads()[h.id].status, 'paused');
  const running = h.mod.downloadSttModel(h.id); await tick(); h.finish(); await running;
  assert.deepEqual(h.events.map(e => e[0]), ['prepare', 'verify']); assert.equal(h.events[0][1], false);
  assert.equal(h.mod.getSttDownloads()[h.id].status, 'downloaded');
});
test('ignored Range response is discarded and never promoted', async () => {
  const h = downloadsHarness({ paused: true, range: false }); const pending = h.mod.downloadSttModel(h.id); await tick(); h.finish(); await pending;
  assert.ok(!h.events.some(e => e[0] === 'verify')); assert.equal(h.mod.getSttDownloads()[h.id].status, 'error');
});
test('active-process death never reuses stale pause offset; complete candidate recovers', async () => {
  const h = downloadsHarness({ kill: true }); await h.mod.checkSttDownloads(); assert.match(h.mod.getSttDownloads()[h.id].error, /fresh/);
  const running = h.mod.downloadSttModel(h.id); await tick(); h.finish(); await running; assert.equal(h.events[0][1], true);
  const done = downloadsHarness({ completed: true }); await done.mod.checkSttDownloads(); assert.equal(done.mod.getSttDownloads()[done.id].status, 'downloaded');
});
test('explicit pause settles transfer before saving checkpoint; cancel clears only partial', async () => {
  const h = downloadsHarness(); const running = h.mod.downloadSttModel(h.id); await tick(); await h.mod.pauseSttDownload(h.id); await running;
  assert.equal(h.mod.getSttDownloads()[h.id].status, 'paused'); assert.equal(JSON.parse(h.values.get(`offline-stt-download:${h.id}`)).offset, 40);
  await h.mod.cancelSttDownload(h.id); assert.equal(h.mod.getSttDownloads()[h.id].status, 'missing'); assert.equal(h.values.size, 0);
});

test('failed Pause retains transfer exclusion until cancellation and original promise settle', async () => {
  const cancelGate = deferred(); const h = downloadsHarness({ pauseFailure: true, cancelGate });
  const running = h.mod.downloadSttModel(h.id); await tick();
  const pausing = h.mod.pauseSttDownload(h.id); await tick();
  await h.mod.downloadSttModel(models.STT_MODELS[1].id);
  assert.equal(h.events.filter(e => e[0] === 'prepare').length, 1);
  cancelGate.resolve(); await pausing; await running;
  assert.equal(h.mod.getSttDownloads()[h.id].status, 'error');
  assert.equal(JSON.parse(h.values.get(`offline-stt-download:${h.id}`)).state, 'active');
});
