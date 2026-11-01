const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness() {
  const exports = {}; const deleted = [];
  const source = fs.readFileSync('src/lib/recording/lifecycle.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: () => ({ recordingRepository: { clearAccount: async owner => deleted.push(owner) } }) });
  return { ...exports, deleted };
}
const tick = () => new Promise(setImmediate);
test('screen remount waits for ordinary native cleanup before restoring saved chunks', async () => {
  const h = harness(); const native = deferred();
  const unregister = h.registerRecorder('owner', { close: () => native.promise });
  unregister(); let restored = false;
  const waiting = h.waitForRecorderCleanup('owner').then(() => { restored = true; });
  await tick(); assert.equal(restored, false);
  native.resolve(); await waiting; assert.equal(restored, true);
  assert.deepEqual(h.deleted, []);
});
test('a second recorder registration closes and awaits the previous controller', async () => {
  const h = harness(); const native = deferred(); let closing = false;
  h.registerRecorder('owner', { close: () => { closing = true; return native.promise; } });
  const unregister = h.registerRecorder('owner', { close: async () => {} });
  let ready = false; const waiting = h.waitForRecorderCleanup('owner').then(() => { ready = true; });
  await tick(); assert.equal(closing, true); assert.equal(ready, false);
  native.resolve(); await waiting; unregister(); await h.waitForRecorderCleanup('owner');
});
test('account deletion waits for native settlement and remains isolated to its owner', async () => {
  const h = harness(); const native = deferred();
  h.registerRecorder('owner-a', { close: () => native.promise });
  h.registerRecorder('owner-b', { close: async () => assert.fail('Other account must remain untouched') });
  const clearing = h.clearRecorderAccount('owner-a'); await tick(); assert.deepEqual(h.deleted, []);
  native.resolve(); await clearing; assert.deepEqual(h.deleted, ['owner-a']);
});
