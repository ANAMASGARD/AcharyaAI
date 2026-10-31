const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const exportsForPcm = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/recording/pcm.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsForPcm });
const { PcmChunker, encodeWav } = exportsForPcm;
const buffer = (samples, sampleRate = 16000, channels = 1) => ({ data: samples.buffer, sampleRate, channels });

test('65 seconds in arbitrary native buffers emits ordered 30, 30, 5 second WAV chunks', () => {
  const chunks = [];
  const chunker = new PcmChunker((wav, startMs, durationMs) => chunks.push({ wav, startMs, durationMs }));
  const samples = Float32Array.from({ length: 65 * 16000 }, (_, i) => i < 480000 ? 0.25 : i < 960000 ? -0.25 : 0.5);
  for (let i = 0; i < samples.length; i += 32767) chunker.push(buffer(samples.slice(i, i + 32767)));
  assert.equal(chunks.length, 2, 'full chunks become available before Stop');
  chunker.flush(); chunker.flush();
  assert.deepEqual(chunks.map(({ startMs, durationMs }) => [startMs, durationMs]), [[0, 30000], [30000, 30000], [60000, 5000]]);
  assert.deepEqual(chunks.map(({ wav }) => new DataView(wav.buffer).getInt16(44, true)), [8192, -8192, 16384]);
  assert.deepEqual(chunks.map(({ wav }) => wav.length), [960044, 960044, 160044]);
});

test('exact boundaries, overflowing buffers, and immediate Stop never produce empty chunks', () => {
  const chunks = [];
  const chunker = new PcmChunker((wav, start, duration) => chunks.push([start, duration]));
  chunker.flush(); assert.equal(chunks.length, 0);
  chunker.push(buffer(new Float32Array(960000))); chunker.flush();
  assert.deepEqual(chunks, [[0, 30000], [30000, 30000]]);
});

test('invalid formats and nonfinite samples are rejected before changing buffered audio', () => {
  const chunks = [];
  const chunker = new PcmChunker((wav) => chunks.push(wav));
  for (const input of [buffer(new Float32Array(10), 48000), buffer(new Float32Array(10), 16000, 2),
    { data: new ArrayBuffer(3), sampleRate: 16000, channels: 1 }, buffer(new Float32Array([NaN])), buffer(new Float32Array([Infinity]))]) {
    assert.throws(() => chunker.push(input), /microphone|audio/);
  }
  chunker.flush(); assert.equal(chunks.length, 0);
});

test('WAV header describes little-endian PCM16 and clips amplitudes safely', () => {
  const wav = encodeWav(new Float32Array([-2, -1, 0, 1, 2]));
  const view = new DataView(wav.buffer);
  assert.equal(Buffer.from(wav.slice(0, 4)).toString(), 'RIFF');
  assert.equal(Buffer.from(wav.slice(8, 16)).toString(), 'WAVEfmt ');
  assert.equal(view.getUint32(4, true), wav.length - 8);
  assert.equal(view.getUint16(20, true), 1); assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000); assert.equal(view.getUint32(28, true), 32000);
  assert.equal(view.getUint16(32, true), 2); assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 10);
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => view.getInt16(44 + i * 2, true)), [-32768, -32768, 0, 32767, 32767]);
});
