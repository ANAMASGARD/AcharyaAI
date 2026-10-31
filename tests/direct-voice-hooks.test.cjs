const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
function moduleFrom(file, mocks, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, AbortController, setTimeout, clearTimeout, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }, ...extra });
  return exports;
}
function runtime() {
  const slots = []; let index = 0; const effects = []; let focus; let focusCleanup;
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
  const react = {
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useCallback(fn, deps) { const i = index++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = index++; if (!same(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  return { react, router: { useFocusEffect(fn) { if (focus !== fn) { focusCleanup?.(); focus = fn; focusCleanup = fn(); } } },
    render(fn) { index = 0; const result = fn(); effects.splice(0).forEach(fn => fn()); return result; },
    blur() { focusCleanup?.(); },
    unmount() { focusCleanup?.(); slots.forEach(slot => slot?.cleanup?.()); },
  };
}
function voiceHarness({ permission = async () => ({ granted: true }), start, transcribe = async () => 'hello', platform = 'android' } = {}) {
  const hooks = runtime(); const events = []; const texts = []; const files = [];
  let app; let buffer; let active = false;
  const stream = { start: async () => { events.push('start'); if (start) await start(); }, stop: () => events.push('stop') };
  const pcm = moduleFrom('src/lib/recording/pcm.ts', {});
  const mocks = {
    react: hooks.react, 'expo-router': hooks.router,
    '@clerk/expo': { useAuth: () => ({ userId: 'alice' }) },
    'react-native': { Platform: { OS: platform }, AppState: { addEventListener: (_, fn) => { app = fn; return { remove() {} }; } } },
    'expo-audio': { requestRecordingPermissionsAsync: permission, setAudioModeAsync: async () => {}, useAudioStream: options => { buffer = options.onBuffer; return { stream }; } },
    'expo-file-system': { Paths: { cache: '/cache' }, File: class { exists = false; write(bytes) { this.bytes = bytes; this.exists = true; files.push(this); } delete() { this.exists = false; } } },
    '@/lib/id': { createId: () => 'id' }, '@/lib/ai-keys/vault': { getProviderCredential: async () => ({ apiKey: 'key' }) },
    '@/lib/ai/speech': { transcribeAudio: async (...args) => { events.push('transcribe'); return transcribe(...args); } },
    '@/lib/recording/pcm': pcm,
    '@/lib/recording/audio-focus': { isRecorderMicrophoneActive: () => active, setRecorderMicrophoneActive: value => { active = value; } },
  };
  const { useVoiceInput } = moduleFrom('src/hooks/use-voice-input.ts', mocks);
  return { render: () => hooks.render(() => useVoiceInput(text => texts.push(text))), hooks, events, texts, files,
    background: () => app('background'), buffer: samples => buffer({ data: new Float32Array(samples).buffer, sampleRate: 16000, channels: 1 }) };
}
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
test('short voice capture transcribes PCM and removes the temporary file after delivery', async () => {
  const h = voiceHarness(); await h.render().startRecording();
  h.buffer(16000); await h.render().stopRecording();
  assert.deepEqual(h.texts, ['hello']); assert.ok(h.events.includes('stop'));
  assert.equal(h.files[0].bytes.length, 32044); assert.equal(h.files[0].exists, false);
  h.hooks.unmount();
});
test('permission denial and web do not start capture or send audio', async () => {
  for (const options of [{ permission: async () => ({ granted: false }) }, { platform: 'web' }]) {
    const h = voiceHarness(options); await h.render().startRecording();
    assert.equal(h.events.length, 0); assert.ok(h.render().error); h.hooks.unmount();
  }
});
test('Stop during permission and background during native start do not resurrect microphone', async () => {
  let grant;
  const h = voiceHarness({ permission: () => new Promise(resolve => { grant = resolve; }) });
  const starting = h.render().startRecording(); await tick();
  await h.render().stopRecording(); grant({ granted: true }); await starting;
  assert.equal(h.events.includes('start'), false); h.hooks.unmount();
  let nativeStarted;
  const late = voiceHarness({ start: () => new Promise(resolve => { nativeStarted = resolve; }) });
  const pending = late.render().startRecording(); await tick(); late.background();
  nativeStarted(); await pending;
  assert.equal(late.events.at(-1), 'stop'); assert.equal(late.render().status, 'idle'); late.hooks.unmount();
});
test('late voice result after navigation is discarded and cached audio is removed', async () => {
  let resolveText;
  const h = voiceHarness({ transcribe: () => new Promise(resolve => { resolveText = resolve; }) });
  await h.render().startRecording(); h.buffer(8000);
  const pending = h.render().stopRecording(); await tick(); h.hooks.blur();
  resolveText('late secret'); await pending;
  assert.deepEqual(h.texts, []); assert.equal(h.files[0].exists, false); h.hooks.unmount();
});
test('30-second boundary automatically finishes exactly one voice segment', async () => {
  const h = voiceHarness(); await h.render().startRecording(); h.buffer(480000); await tick();
  assert.deepEqual(h.texts, ['hello']); assert.equal(h.events.filter(event => event === 'transcribe').length, 1);
  assert.equal(h.files[0].bytes.length, 960044); h.hooks.unmount();
});
