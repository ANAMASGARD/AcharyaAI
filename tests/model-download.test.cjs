const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup({ go = false, os = 'android', failVerify = false } = {}) {
  const calls = []; let complete; let progress;
  const native = {
    downloadsAvailable: true, available: false,
    modelDownloaded: async () => false,
    prepareDownload: async () => { calls.push('prepare'); return 'file:///private/model.part'; },
    finishDownload: async () => { calls.push('verify'); if (failVerify) throw Error('Checksum'); },
    discardDownload: async () => { calls.push('discard'); }, removeModel: async () => { calls.push('remove'); },
  };
  const mocks = {
    expo: { isRunningInExpoGo: () => go, requireOptionalNativeModule: () => { calls.push('native'); return native; } },
    'react-native': { Platform: { OS: os } },
    'expo-file-system/legacy': { createDownloadResumable: (url, path, options, callback) => {
      calls.push({ url, path }); progress = callback;
      return { downloadAsync: () => new Promise(resolve => { complete = resolve; }), cancelAsync: async () => { calls.push('cancel'); complete(undefined); } };
    } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/embeddings/download.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => mocks[name], setTimeout: () => 1, clearTimeout() {} });
  return { api: exports, calls, complete: response => complete(response), progress: bytes => progress({ totalBytesWritten: bytes }), tick: () => new Promise(resolve => setImmediate(resolve)) };
}
test('pinned model download updates progress and becomes downloaded only after verification', async () => {
  const h = setup(); await h.api.checkModelDownload();
  assert.equal(h.api.getModelDownloadState().status, 'missing');
  const work = h.api.downloadModel(); await h.tick(); await h.api.downloadModel();
  assert.equal(h.calls.filter(c => c === 'prepare').length, 1);
  assert.match(h.calls.find(c => c.url).url, /\/resolve\/9be6e8b90982095dc05c2bd162e4b954ee4dbac7\/embeddinggemma-2-text-270m.litertlm$/);
  h.progress(82_313_216); assert.equal(h.api.getModelDownloadState().progress, 0.5);
  h.complete({ status: 200 }); await work;
  assert.equal(h.api.getModelDownloadState().status, 'downloaded');
  assert.ok(h.calls.indexOf('verify') < h.calls.indexOf('discard'));
  await h.api.removeModelDownload(); assert.equal(h.api.getModelDownloadState().status, 'missing');
});
test('failed verification and cancellation never show a usable model', async () => {
  const failed = setup({ failVerify: true }); const work = failed.api.downloadModel(); await failed.tick(); failed.complete({ status: 200 }); await work;
  assert.equal(failed.api.getModelDownloadState().status, 'error'); assert.ok(failed.calls.includes('discard'));
  const cancelled = setup(); const active = cancelled.api.downloadModel(); await cancelled.tick(); await cancelled.api.cancelModelDownload(); await active;
  assert.equal(cancelled.api.getModelDownloadState().status, 'missing'); assert.ok(!cancelled.calls.includes('verify'));
});
test('Expo Go, iOS and web never try loading the custom module or downloading', async () => {
  for (const options of [{ go: true }, { os: 'ios' }, { os: 'web' }]) {
    const h = setup(options); await h.api.downloadModel();
    assert.equal(h.api.modelDownloadsAvailable, false); assert.equal(h.calls.length, 0);
  }
});
