const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const report = { classroomEnvironment: 'Unknown', whatWentWrong: 'None evidenced', areasToImprove: 'Examples', topicSpecificFeedback: 'Math', overallScore: 60 };
const generated = { report, classNotes: '## Quick Summary\nFractions', model: 'gpt-6-luna' };
const snapshot = () => ({ session: { id: 'session1', ownerClerkId: 'alice', title: 'Fractions', subject: 'Math', grade: '6', status: 'complete', serverFinalized: true }, chunks: [{ status: 'done', transcript: 'A half plus a half is one.' }] });
function harness(saveHistory = async () => {}) {
  const slots = []; const effects = []; const calls = []; let cursor = 0; let saved = null; let listener; const focusCleanups = [];
  let owner = 'alice'; let recording = snapshot(); let busy = false;
  const mocks = {
    '@react-native-community/netinfo': { useNetInfo: () => ({ isConnected: true, isInternetReachable: true }) },
    '@/components/preview/preview-provider': { useUiPreferences: () => ({ offlineReportsEnabled: true }), usePreviewFeature: () => [saved, (value) => { saved = value; }] },
    '@/lib/reports/history': { saveReportHistory: saveHistory, readSavedReportResult: async () => null },
    '@/lib/reports/generate': { generateSavedClassReport: (account, sessionId, backend, input, signal, onPhase) => new Promise((resolve, reject) => calls.push({ account, input, signal, onPhase, resolve, reject })) },
    '@/lib/offline-reports/download': { reportDownloads: { subscribe: () => () => {}, getState: () => ({ gemma: { status: 'downloaded' } }), check: async () => {} } },
    '@/lib/offline-reports/model': { reportModel: () => ({ id: 'gemma' }), reportDownloadPublished: true },
    '@/lib/offline-reports/bridge': { reportRuntimeAvailable: true },
    '@/lib/offline-reports/engine': { localReportBusy: () => false, subscribeLocalReport: () => () => {} },
    '@/lib/ai/cancellation': { registerAiRequest: () => () => {} },
    'expo-router': { useFocusEffect: (fn) => { focusCleanups.push(fn()); } },
    'react-native': { AppState: { addEventListener: (_, fn) => { listener = fn; return { remove() {} }; } } },
    react: {
      useSyncExternalStore: (_subscribe, get) => get(),
      useRef: (value) => slots[cursor++] ??= { current: value },
      useState: (value) => { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], (next) => { slots[index] = next; }]; },
      useCallback: (fn) => fn,
      useEffect: (fn, deps) => { const index = cursor++; const prior = slots[index]; if (!prior || deps.some((item, i) => item !== prior.deps[i])) effects.push(() => { prior?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); },
    },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/use-recorder-analysis.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, AbortController, Date, Error, require: (name) => { assert.ok(name in mocks, name); return mocks[name]; } });
  return { calls, render: () => { cursor = 0; return exports.useRecorderAnalysis(owner, recording, busy); },
    flush: () => { while (effects.length) effects.shift()(); },
    background: () => listener('background'), blur: () => focusCleanups.forEach(fn => fn?.()), getSaved: () => saved,
    switchOwner: () => { owner = 'bob'; recording = null; }, setSnapshot: (value) => { recording = value; }, setBusy: (value) => { busy = value; },
  };
}
test('ready transcript enables Send; double tap generates once and persists notes for the exact session', async () => {
  const h = harness(); const first = h.render(); h.flush(); assert.equal(first.canSend, true);
  const pending = first.send(); await first.send(); assert.equal(h.calls.length, 1);
  assert.equal(h.render().isAnalyzing, true); assert.equal(h.render().canSend, false);
  assert.equal(h.calls[0].input.topic, 'Fractions');
  h.calls[0].onPhase('Creating class summary…'); assert.match(h.render().reportProgress, /summary/);
  h.calls[0].resolve(generated); await pending;
  assert.equal(h.render().classNotes, generated.classNotes); assert.equal(h.render().canSend, false);
  assert.equal(h.getSaved().sessionId, 'session1');
  const next = snapshot(); next.session.id = 'session2'; h.setSnapshot(next);
  assert.equal(h.render().report, null); assert.equal(h.render().canSend, true);
});
test('silence, missing chunks, active capture and unfinished finalization cannot be sent', async () => {
  for (const change of [s => { s.chunks[0].status = 'empty'; }, s => { s.chunks[0].status = 'failed'; }, s => { s.chunks.push({ status: 'pending', transcript: '' }); }, s => { s.session.ownerClerkId = 'other-account'; }, s => { s.session.status = 'recording'; }, s => { s.session.serverFinalized = false; }]) {
    const h = harness(); const value = snapshot(); change(value); h.setSnapshot(value);
    const view = h.render(); h.flush(); assert.equal(view.canSend, false); await view.send(); assert.equal(h.calls.length, 0);
  }
  const h = harness(); h.setBusy(true); assert.equal(h.render().canSend, false);
});
test('background, navigation and account switch cancel requests and ignore late provider success', async () => {
  for (const action of ['background', 'blur', 'switchOwner']) {
    const h = harness(); const view = h.render(); h.flush(); const pending = view.send();
    h[action](); h.render(); h.flush(); assert.equal(h.calls[0].signal.aborted, true);
    h.calls[0].onPhase('notes'); h.calls[0].resolve(generated); await pending;
    assert.equal(h.getSaved(), null); assert.equal(h.render().isAnalyzing, false);
  }
});
test('report errors retain the transcript, re-enable Send and permit manual retry', async () => {
  const h = harness(); const view = h.render(); h.flush(); const pending = view.send();
  h.calls[0].reject(new Error('Quota reached')); await pending;
  assert.equal(h.render().reportError, 'Quota reached'); assert.equal(h.render().canSend, true);
  const retry = h.render().send(); assert.equal(h.calls.length, 2);
  h.calls[1].resolve(generated); await retry; assert.equal(h.render().reportError, null);
  assert.equal(h.render().report, report);
});
test('cancellation blocks a second Send until the original generation settles', async () => {
  const h = harness(); h.render(); h.flush(); const first = h.render().send(); h.render().cancel();
  await h.render().send(); assert.equal(h.calls.length, 1); assert.equal(h.render().isAnalyzing, true);
  h.calls[0].resolve(generated); await first;
  assert.equal(h.getSaved(), null); assert.equal(h.render().isAnalyzing, false);
  const second = h.render().send(); h.calls[1].resolve(generated); await second;
  assert.equal(h.render().classNotes, generated.classNotes);
});

test('storage retry retains generated report and never calls the paid model twice', async () => {
  let saves = 0;
  const h = harness(async () => { if (++saves === 1) throw Error('Disk full'); });
  h.render(); h.flush(); const pending = h.render().send();
  h.calls[0].resolve(generated); await pending;
  assert.match(h.render().reportError, /retry saving/);
  assert.equal(h.getSaved(), null);
  await h.render().send();
  assert.equal(saves, 2); assert.equal(h.calls.length, 1);
  assert.equal(h.render().classNotes, generated.classNotes);
});
