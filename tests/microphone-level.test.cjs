const test = require('node:test');
const assert = require('node:assert/strict');
const { microphoneLevel } = require('../src/lib/microphone-level.ts');

test('silence and low room noise remain dots, audible input yields bounded waves', () => {
  assert.equal(microphoneLevel(new Float32Array()), 0);
  assert.equal(microphoneLevel(new Float32Array(160)), 0);
  assert.equal(microphoneLevel(new Float32Array(160).fill(0.001)), 0);
  const quietVoice = microphoneLevel(new Float32Array(160).fill(0.02));
  const loudVoice = microphoneLevel(new Float32Array(160).fill(0.2));
  assert.ok(quietVoice > 0 && loudVoice > quietVoice);
  assert.equal(microphoneLevel(new Float32Array(160).fill(1)), 1);
  assert.equal(microphoneLevel(new Float32Array([NaN, Infinity])), 0);
});

function mountMic(permission) {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const ts = require('typescript');
  const effects = [];
  const errors = [];
  const exports = {};
  let options;
  const calls = { start: 0, stop: 0 };
  const mocks = {
    react: { useRef: (current) => ({ current }), useState: () => [null, (value) => errors.push(value)], useEffect: (fn) => effects.push(fn) },
    'expo-audio': {
      requestRecordingPermissionsAsync: () => permission,
      setAudioModeAsync: async () => {},
      useAudioStream: (value) => {
        options = value;
        return { stream: { start: async () => { calls.start++; }, stop: () => calls.stop++ }, isStreaming: true };
      },
    },
    '@/lib/microphone-level': { microphoneLevel },
  };
  const code = ts.transpileModule(fs.readFileSync('src/hooks/use-microphone-level.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, Float32Array, Date, require: (name) => mocks[name] });
  const result = exports.useMicrophoneLevel(true);
  const cleanup = effects[0]();
  return { result, cleanup, calls, errors, buffer: () => options.onBuffer({ data: new Float32Array(160).fill(0.1).buffer }) };
}

test('local mic accepts levels only while active and clears levels on cleanup', async () => {
  const mic = mountMic(Promise.resolve({ granted: true }));
  await new Promise(setImmediate);
  assert.equal(mic.calls.start, 1);
  mic.buffer();
  assert.ok(mic.result.latest.current.level > 0);
  mic.cleanup();
  assert.equal(mic.result.latest.current.level, 0);
  mic.buffer();
  assert.equal(mic.result.latest.current.level, 0);
  assert.equal(mic.calls.stop, 1);
});

test('denied permission or closing while permission is pending never starts capture', async () => {
  const denied = mountMic(Promise.resolve({ granted: false }));
  await new Promise(setImmediate);
  assert.equal(denied.calls.start, 0);
  assert.match(denied.errors[0], /Microphone access is off/);
  denied.cleanup();
  let grant;
  const closed = mountMic(new Promise((resolve) => { grant = resolve; }));
  closed.cleanup();
  grant({ granted: true });
  await new Promise(setImmediate);
  assert.equal(closed.calls.start, 0);
});
