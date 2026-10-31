const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function harness(options = {}) {
  const timers = new Map(); const intervals = new Map(); let timerId = 0; let now = 100000;
  class Clock extends Date { static now() { return now; } }
  const modules = {};
  function load(name) {
    if (modules[name]) return modules[name];
    const exports = {}; modules[name] = exports;
    const source = fs.readFileSync(`src/lib/recording/${name}.ts`, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require: (path) => load(path.replace('./', '')), AbortController, Error, Date: Clock,
      setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: (id) => timers.delete(id),
      setInterval: (fn) => { intervals.set(++timerId, fn); return timerId; }, clearInterval: (id) => intervals.delete(id) });
    return exports;
  }
  const { RecorderController } = load('controller');
  const { RecordingApiError } = load('types');
  const events = []; let id = 0; let captureStarts = 0;
  const clone = (item) => JSON.parse(JSON.stringify(item));
  const repository = {
    loadLatest: async () => options.saved || null,
    saveSession: async (session) => { events.push(['session', clone(session)]); },
    saveChunk: async (owner, chunk) => { events.push(['chunk', clone(chunk)]); },
    writeAudio: async (owner, chunkId, wav) => { events.push(['write', chunkId, wav.length]); return `file://${chunkId}`; },
    deleteAudio: async (owner, uri) => { events.push(['delete', uri]); }, clearAccount: async () => {}, ...options.repository,
  };
  const api = {
    create: async (session) => { events.push(['create', session.id]); },
    finalize: async (session) => { events.push(['finalize', clone(session)]); },
    transcribe: async (chunk) => { events.push(['upload', chunk.id]); return { chunkId: chunk.id, chunkIndex: chunk.index, status: 'done', transcript: 'repeat' }; }, ...options.api,
  };
  const capture = { start: async () => { captureStarts++; if (options.captureStart) await options.captureStart(); }, stop: () => events.push(['stop']) };
  const controller = new RecorderController('teacher', repository, api, capture, () => `id${++id}`);
  return { controller, events, api, RecordingApiError, starts: () => captureStarts,
    stall: async (ms) => { now += ms; for (const fn of intervals.values()) fn(); await settle(); },
    tick: async () => { const entry = timers.entries().next().value; assert.ok(entry, 'retry scheduled'); timers.delete(entry[0]); now += entry[1].delay; entry[1].fn(); await settle(); return entry[1].delay; } };
}
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
const metadata = { title: 'Lesson', subject: 'Math', grade: '7' };
const push = (controller, seconds) => controller.push({ data: new Float32Array(seconds * 16000).buffer, sampleRate: 16000, channels: 1 });
const begin = async (h) => { await h.controller.restore(); await h.controller.start(metadata); };
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('65-second recording persists then uploads chunks and saves text before deleting audio', async () => {
  const h = harness(); await begin(h);
  push(h.controller, 30); await settle();
  assert.equal(h.controller.getSnapshot().snapshot.chunks[0].transcript, 'repeat');
  push(h.controller, 35); await h.controller.stop(); await settle();
  const { session, chunks } = h.controller.getSnapshot().snapshot;
  assert.equal(session.status, 'complete'); assert.equal(session.serverFinalized, true);
  assert.deepEqual(Array.from(chunks, (c) => [c.index, c.startMs, c.durationMs]), [[0, 0, 30000], [1, 30000, 30000], [2, 60000, 5000]]);
  assert.equal(Array.from(chunks, (c) => c.transcript).join(' '), 'repeat repeat repeat');
  for (const chunk of chunks) {
    const at = (name, predicate) => h.events.findIndex((event) => event[0] === name && predicate(event));
    const write = at('write', (e) => e[1] === chunk.id);
    const pending = at('chunk', (e) => e[1].id === chunk.id && e[1].status === 'pending');
    const upload = at('upload', (e) => e[1] === chunk.id);
    const done = at('chunk', (e) => e[1].id === chunk.id && e[1].status === 'done');
    const deletion = at('delete', (e) => e[1] === `file://${chunk.id}`);
    assert.ok(write < pending && pending < upload && upload < done && done < deletion);
  }
  await h.controller.close();
});

test('silence is retained as an empty successful segment and immediate Stop sends no audio', async () => {
  const h = harness({ api: { transcribe: async (c) => ({ chunkId: c.id, chunkIndex: c.index, status: 'empty', transcript: '' }) } });
  await begin(h); push(h.controller, 1); await h.controller.stop(); await settle();
  assert.equal(h.controller.getSnapshot().snapshot.chunks[0].status, 'empty');
  assert.equal(h.controller.getSnapshot().snapshot.session.status, 'complete'); await h.controller.close();
  const empty = harness(); await begin(empty); await empty.controller.stop(); await settle();
  assert.equal(empty.events.filter((e) => e[0] === 'upload').length, 0);
  assert.equal(empty.controller.getSnapshot().snapshot.session.status, 'failed'); await empty.controller.close();
});

test('transient failures retry at 1, 4, 16 seconds and manual retry replaces the same chunk', async () => {
  const h = harness(); h.api.transcribe = async () => { throw new h.RecordingApiError('offline', true); };
  await begin(h); push(h.controller, 1); await h.controller.stop(); await settle();
  const delays = []; for (let i = 0; i < 3; i++) delays.push(await h.tick());
  assert.deepEqual(delays, [1000, 4000, 16000]);
  assert.equal(h.controller.getSnapshot().snapshot.chunks[0].attempts, 4);
  assert.equal(h.controller.getSnapshot().snapshot.chunks[0].status, 'failed');
  assert.equal(h.events.filter((e) => e[0] === 'delete').length, 0);
  h.api.transcribe = async (c) => ({ chunkId: c.id, chunkIndex: c.index, status: 'done', transcript: 'Recovered' });
  await h.controller.retry(); await settle();
  assert.equal(h.controller.getSnapshot().snapshot.chunks.length, 1);
  assert.equal(h.controller.getSnapshot().snapshot.chunks[0].transcript, 'Recovered');
  assert.equal(h.controller.getSnapshot().snapshot.session.status, 'complete'); await h.controller.close();
});

test('response identity mismatch preserves audio and reports partial transcription', async () => {
  const h = harness({ api: { transcribe: async () => ({ chunkId: 'wrong', chunkIndex: 0, status: 'done', transcript: 'wrong' }) } });
  await begin(h); push(h.controller, 1); await h.controller.stop(); await settle();
  assert.equal(h.controller.getSnapshot().snapshot.session.status, 'partial');
  assert.equal(h.controller.getSnapshot().snapshot.chunks[0].transcript, '');
  assert.equal(h.events.filter((e) => e[0] === 'delete').length, 0); await h.controller.close();
});

test('restore retries processing chunks without starting the microphone', async () => {
  const seed = harness(); await begin(seed); push(seed.controller, 1); await seed.controller.stop(); await settle();
  const saved = JSON.parse(JSON.stringify(seed.controller.getSnapshot().snapshot));
  saved.session.status = 'recording'; saved.session.serverFinalized = false;
  saved.chunks[0].status = 'processing'; saved.chunks[0].localUri = 'file://saved'; await seed.controller.close();
  const h = harness({ saved }); await h.controller.restore(); await settle();
  assert.equal(h.starts(), 0); assert.equal(h.controller.getSnapshot().hydrated, true);
  assert.equal(h.controller.getSnapshot().snapshot.chunks[0].status, 'done');
  assert.equal(h.controller.getSnapshot().snapshot.session.status, 'partial'); await h.controller.close();
});

test('permission rejection never starts uploads and late provider results after close are ignored', async () => {
  const denied = harness({ captureStart: async () => { throw new Error('Permission denied'); } });
  await begin(denied); assert.equal(denied.controller.getSnapshot().snapshot.session.status, 'failed');
  assert.match(denied.controller.getSnapshot().error, /Permission/); await denied.controller.close();
  const pending = deferred(); const h = harness({ api: { transcribe: () => pending.promise } });
  await begin(h); push(h.controller, 30); await settle(); await h.controller.close();
  const before = h.events.length; const chunk = h.controller.getSnapshot().snapshot.chunks[0];
  pending.resolve({ chunkId: chunk.id, chunkIndex: 0, status: 'done', transcript: 'late' }); await settle();
  assert.equal(h.events.length, before); assert.notEqual(h.controller.getSnapshot().snapshot.chunks[0].transcript, 'late');
});

test('Stop during server creation never starts microphone after the request resolves', async () => {
  const pending = deferred(); const h = harness({ api: { create: () => pending.promise } });
  await h.controller.restore(); const starting = h.controller.start(metadata); await settle();
  await h.controller.stop(); pending.resolve(); await starting; await settle();
  assert.equal(h.starts(), 0); assert.notEqual(h.controller.getSnapshot().snapshot.session.status, 'recording');
  await h.controller.close();
});

test('Stop during durable server acknowledgement prevents a late microphone start', async () => {
  const pending = deferred(); let saving = false;
  const h = harness({ repository: { saveSession: async (session) => {
    if (session.status === 'starting' && session.serverCreated) { saving = true; await pending.promise; }
  } } });
  await h.controller.restore(); const starting = h.controller.start(metadata); await settle(); assert.equal(saving, true);
  const stopping = h.controller.stop(); pending.resolve(); await Promise.all([starting, stopping]); await settle();
  assert.equal(h.starts(), 0); await h.controller.close();
});

test('restore completes a server finalization interrupted after local completion', async () => {
  const seed = harness(); await begin(seed); push(seed.controller, 1); await seed.controller.stop(); await settle();
  const saved = JSON.parse(JSON.stringify(seed.controller.getSnapshot().snapshot));
  saved.session.serverFinalized = false; await seed.controller.close();
  const h = harness({ saved }); await h.controller.restore(); await settle();
  assert.equal(h.events.filter((event) => event[0] === 'finalize').length, 1);
  assert.equal(h.controller.getSnapshot().snapshot.session.serverFinalized, true); await h.controller.close();
});

test('invalid capture format flushes valid buffered samples and marks the recording partial', async () => {
  const h = harness(); await begin(h); push(h.controller, 1);
  h.controller.push({ data: new Float32Array(100).buffer, sampleRate: 48000, channels: 2 }); await settle();
  assert.equal(h.controller.getSnapshot().snapshot.chunks.length, 1);
  assert.equal(h.controller.getSnapshot().snapshot.chunks[0].durationMs, 1000);
  assert.equal(h.controller.getSnapshot().snapshot.session.status, 'partial');
  assert.match(h.controller.getSnapshot().snapshot.session.error, /microphone/); await h.controller.close();
});

test('failed durable audio write stops capture without uploading unsaved audio', async () => {
  const h = harness({ repository: { writeAudio: async () => { throw new Error('Storage is full'); } } });
  await begin(h); push(h.controller, 30); await settle();
  assert.equal(h.events.filter((event) => event[0] === 'upload').length, 0);
  assert.ok(['failed', 'partial'].includes(h.controller.getSnapshot().snapshot.session.status));
  await h.controller.close();
});

test('stalled capture stops safely, flushes audio and requires an explicit restart', async () => {
  const h = harness(); await begin(h); push(h.controller, 1); await h.stall(6000);
  assert.equal(h.controller.getSnapshot().snapshot.session.status, 'partial');
  assert.match(h.controller.getSnapshot().snapshot.session.error, /interrupted/);
  assert.equal(h.controller.getSnapshot().snapshot.chunks[0].durationMs, 1000);
  push(h.controller, 30); await h.stall(6000);
  assert.equal(h.starts(), 1); assert.equal(h.controller.getSnapshot().snapshot.chunks.length, 1);
  await h.controller.close();
});

test('a failed finalization restores and completes without treating network error as capture loss', async () => {
  const seed = harness({ api: { finalize: async () => { throw new Error('Network unavailable'); } } });
  await begin(seed); push(seed.controller, 1); await seed.controller.stop(); await settle();
  const saved = JSON.parse(JSON.stringify(seed.controller.getSnapshot().snapshot));
  assert.equal(saved.session.status, 'partial'); assert.equal(saved.session.error, null);
  assert.equal(saved.session.serverFinalized, false); await seed.controller.close();
  const h = harness({ saved }); await h.controller.restore(); await settle();
  assert.equal(h.controller.getSnapshot().snapshot.session.status, 'complete');
  assert.equal(h.controller.getSnapshot().snapshot.session.serverFinalized, true); await h.controller.close();
});

test('close during queued processing persistence does not dispatch an upload after cleanup', async () => {
  const pending = deferred(); let saving = false;
  const h = harness({ repository: { saveChunk: async (owner, chunk) => {
    if (chunk.status === 'processing') { saving = true; await pending.promise; }
  } } });
  await begin(h); push(h.controller, 30); await settle(); assert.equal(saving, true);
  const closing = h.controller.close(); pending.resolve(); await closing; await settle();
  assert.equal(h.events.filter((e) => e[0] === 'upload').length, 0);
});

test('close during finalization persistence does not call the backend after cleanup starts', async () => {
  const pending = deferred(); let saving = false;
  const h = harness({ repository: { saveSession: async (session) => {
    if (session.status === 'complete') { saving = true; await pending.promise; }
  } } });
  await begin(h); push(h.controller, 1); await h.controller.stop(); await settle(); assert.equal(saving, true);
  const closing = h.controller.close(); pending.resolve(); await closing; await settle();
  assert.equal(h.events.filter((e) => e[0] === 'finalize').length, 0);
});

test('one sample past the 30-second boundary keeps nonzero tail timing', async () => {
  const h = harness(); await begin(h);
  h.controller.push({ data: new Float32Array(480001).buffer, sampleRate: 16000, channels: 1 });
  await h.controller.stop(); await settle();
  const { session, chunks } = h.controller.getSnapshot().snapshot;
  assert.equal(chunks.length, 2); assert.equal(chunks[1].startMs, 30000); assert.equal(chunks[1].durationMs, 1);
  assert.equal(session.durationMs, 30001); await h.controller.close();
});

test('new classroom clears only a finished view and waits for an explicit recording start', async () => {
  const h = harness(); await begin(h);
  assert.equal(h.controller.prepareNewSession(), false);
  push(h.controller, 1); await h.controller.stop(); await settle();
  const previousId = h.controller.getSnapshot().snapshot.session.id;
  const eventCount = h.events.length;
  assert.equal(h.controller.prepareNewSession(), true);
  assert.equal(h.controller.getSnapshot().snapshot, null);
  assert.equal(h.controller.getSnapshot().hydrated, true);
  assert.equal(h.starts(), 1);
  assert.equal(h.events.length, eventCount, 'preparing a new class must not modify saved data');
  assert.equal(h.controller.prepareNewSession(), false);
  await h.controller.start({ ...metadata, title: 'Next class' });
  assert.notEqual(h.controller.getSnapshot().snapshot.session.id, previousId);
  assert.equal(h.controller.getSnapshot().snapshot.chunks.length, 0);
  assert.equal(h.starts(), 2);
  await h.controller.stop(); await settle(); await h.controller.close();
});
