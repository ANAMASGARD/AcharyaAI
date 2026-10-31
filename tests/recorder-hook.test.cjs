const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function hookHarness(platform = 'android') {
  let owner = 'teacher-a'; let cursor = 0; let focusCleanup; let appCallback;
  const slots = []; const effects = []; const controllers = []; const events = [];
  const draft = { topic: 'Fractions', subject: 'Math', classLevel: '7' };
  const getToken = async () => 'token';
  const stream = { start: async () => events.push('native-start'), stop: () => events.push('native-stop') };
  class Controller {
    constructor(id, repository, api, capture) {
      this.owner = id; this.capture = capture; this.listeners = new Set(); this.starts = []; this.stops = [];
      this.view = { snapshot: null, hydrated: false, busy: false, error: null }; controllers.push(this);
    }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    getSnapshot() { return this.view; }
    publish(view) { this.view = view; this.listeners.forEach((listener) => listener()); }
    async restore() { this.publish({ ...this.view, hydrated: true }); }
    async start(metadata) { this.starts.push(metadata); }
    async stop(reason) { this.stops.push(reason); this.capture.stop(); }
    async retry() {}
    push(buffer) { this.buffer = buffer; }
  }
  let streamOptions;
  const mocks = {
    '@/components/preview/preview-provider': { usePreviewFeature: () => [draft, () => {}] },
    '@/lib/id': { createId: () => 'id' }, '@/lib/recording/direct-api': { createDirectRecordingApi: () => ({}) },
    '@/lib/recording/audio-focus': { setRecorderMicrophoneActive: () => {} },
    '@/lib/recording/controller': { RecorderController: Controller },
    '@/lib/recording/lifecycle': { registerRecorder: () => () => events.push('unregister'), waitForRecorderCleanup: async () => {} },
    '@/lib/recording/repository': { recordingRepository: {} },
    '@clerk/expo': { useAuth: () => ({ userId: owner, getToken }) },
    'expo-audio': { requestRecordingPermissionsAsync: async () => ({ granted: true }), setAudioModeAsync: async () => {}, useAudioStream: (options) => { streamOptions = options; return { stream }; } },
    'expo-router': { useFocusEffect: (callback) => { if (!focusCleanup) focusCleanup = callback(); } },
    'react-native': { Platform: { OS: platform }, AppState: { addEventListener: (name, callback) => { appCallback = callback; return { remove: () => { appCallback = null; } }; } } },
    react: {
      useRef: (initial) => { const index = cursor++; return slots[index] ??= { current: initial }; },
      useState: (initial) => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
      useCallback: (fn) => fn,
      useEffect: (fn, dependencies) => { const index = cursor++; const prior = slots[index];
        if (!prior || dependencies.some((item, i) => item !== prior.dependencies[i])) {
          effects.push(() => { prior?.cleanup?.(); slots[index] = { dependencies, cleanup: fn() }; });
        }
      },
    },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/hooks/use-recorder.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { assert.ok(name in mocks, name); return mocks[name]; }, Date, Error, setInterval: () => 1, clearInterval() {} });
  return { controllers, events,
    render: () => { cursor = 0; return exports.useRecorder(); },
    flush: async () => { while (effects.length) effects.shift()(); await new Promise(setImmediate); },
    background: (state) => appCallback(state), blur: () => focusCleanup(),
    owner: (value) => { owner = value; }, buffer: (value) => streamOptions.onBuffer(value),
  };
}
const completed = (owner) => ({ hydrated: true, busy: false, error: null, snapshot: {
  session: { ownerClerkId: owner, status: 'complete', durationMs: 30000, serverFinalized: true, error: null },
  chunks: [{ index: 0, status: 'done', transcript: 'Private classroom text' }],
} });

test('background and focus blur stop recording, returning active requires an explicit Record tap', async () => {
  const h = hookHarness(); h.render(); await h.flush(); let view = h.render();
  assert.equal(view.canStartRecording, true); view.toggleRecording();
  const controller = h.controllers[0]; assert.equal(controller.starts.length, 1);
  h.background('inactive'); h.background('background'); h.background('active'); h.blur();
  assert.equal(controller.stops.length, 3);
  assert.match(controller.stops[0], /foreground/); assert.match(controller.stops[2], /left the recorder/);
  assert.equal(controller.starts.length, 1, 'focus and active events must not automatically restart capture');
  controller.publish(completed('teacher-a')); view = h.render(); view.toggleRecording();
  assert.equal(controller.starts.length, 2); assert.equal(view.mergedTranscript, 'Private classroom text');
});

test('account switch masks the old transcript before effects run and ignores detached subscriptions', async () => {
  const h = hookHarness(); h.render(); await h.flush(); const old = h.controllers[0];
  old.publish(completed('teacher-a')); assert.equal(h.render().mergedTranscript, 'Private classroom text');
  h.owner('teacher-b'); let view = h.render();
  assert.equal(view.mergedTranscript, ''); assert.equal(view.canStartRecording, false);
  await h.flush(); old.publish(completed('teacher-a')); view = h.render();
  assert.equal(view.mergedTranscript, ''); assert.equal(h.controllers.length, 2);
  assert.ok(h.events.includes('unregister'));
});

test('native audio buffers reach the active controller while web never creates one', async () => {
  const h = hookHarness('ios'); h.render(); await h.flush(); const buffer = { data: new ArrayBuffer(4), sampleRate: 16000, channels: 1 };
  h.buffer(buffer); assert.equal(h.controllers[0].buffer, buffer);
  const web = hookHarness('web'); const view = web.render(); await web.flush();
  assert.equal(web.controllers.length, 0); assert.equal(view.canStartRecording, false);
  assert.match(view.statusMessage, /Android and iOS/);
});
