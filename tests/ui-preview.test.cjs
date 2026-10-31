const assert = require('node:assert/strict');
const test = require('node:test');
const { createPreviewQueue, createPreviewLifecycle, PreviewSessionEndedError } = require('../src/lib/ui-preview/lifecycle.ts');
const { parseDrafts, parsePreferences, restoreAttachmentUris, PreviewDataError } = require('../src/lib/ui-preview/types.ts');

test('preview writes finish in order and a failed write does not block retry', async () => {
  const queue = createPreviewQueue();
  const changes = [];
  const first = queue.run(async () => { changes.push('first'); throw new Error('disk full'); });
  const second = queue.run(async () => { changes.push('retry'); return 'saved'; });
  await assert.rejects(first, /disk full/);
  assert.equal(await second, 'saved');
  assert.deepEqual(changes, ['first', 'retry']);
});

test('sign-out drains accepted writes before deleting drafts and rejects late callbacks', async () => {
  const records = new Map();
  const lifecycle = createPreviewLifecycle(async (owner, includePreferences) => {
    records.delete(`${owner}:drafts`);
    records.delete(`${owner}:files`);
    if (includePreferences) records.delete(`${owner}:preferences`);
  });
  const session = lifecycle.createSession('teacher-a');
  const write = session.run(async () => {
    records.set('teacher-a:drafts', 'draft');
    records.set('teacher-a:files', 'photo');
    records.set('teacher-a:preferences', 'Hindi');
  });
  const clearing = lifecycle.clear('teacher-a');
  await write;
  await clearing;
  await assert.rejects(session.run(async () => records.set('teacher-a:drafts', 'late')), PreviewSessionEndedError);
  assert.deepEqual([...records], [['teacher-a:preferences', 'Hindi']]);
});

test('account deletion clears preferences and cannot erase another account', async () => {
  const records = new Map([['a:draft', 'one'], ['a:preferences', 'Hindi'], ['b:draft', 'two']]);
  const lifecycle = createPreviewLifecycle(async (owner, includePreferences) => {
    records.delete(`${owner}:draft`);
    if (includePreferences) records.delete(`${owner}:preferences`);
  });
  await lifecycle.clear('a', true);
  assert.deepEqual([...records], [['b:draft', 'two']]);
});

test('new hydration waits for an account cleanup already in progress', async () => {
  const events = [];
  let release;
  const pause = new Promise((resolve) => { release = resolve; });
  const lifecycle = createPreviewLifecycle(async () => { await pause; events.push('cleared'); });
  const clearing = lifecycle.clear('a');
  const session = lifecycle.createSession('a');
  const hydration = session.run(async () => { events.push('hydrated'); });
  await Promise.resolve();
  assert.deepEqual(events, []);
  release();
  await Promise.all([clearing, hydration]);
  assert.deepEqual(events, ['cleared', 'hydrated']);
});

test('failed cleanup is retried before another session can hydrate old drafts', async () => {
  let attempts = 0;
  let savedDraft = 'old';
  const lifecycle = createPreviewLifecycle(async () => {
    if (++attempts === 1) throw new Error('storage busy');
    savedDraft = null;
  });
  await assert.rejects(lifecycle.clear('a'), /storage busy/);
  const session = lifecycle.createSession('a');
  assert.equal(await session.run(async () => savedDraft), null);
  assert.equal(attempts, 2);
});

test('malformed or incompatible saved data is reported instead of silently erased', () => {
  assert.deepEqual(parseDrafts(null), {});
  assert.deepEqual(parseDrafts(JSON.stringify({ version: 1, features: { recorder: { topic: 'Plants' } } })), { recorder: { topic: 'Plants' } });
  assert.throws(() => parseDrafts('{bad'), (error) => error instanceof PreviewDataError && error.kind === 'drafts');
  assert.throws(() => parseDrafts('{"version":2,"features":{}}'), PreviewDataError);
  assert.throws(() => parsePreferences('{"selectedLanguageId":5}'), (error) => error instanceof PreviewDataError && error.kind === 'preferences');
  assert.equal(parsePreferences(null).pushNotificationsEnabled, true);
});

test('attachment restore replaces temporary URIs and marks missing local files for reselection', () => {
  const data = { notes: { files: [{ id: 'a', uri: 'file:///old-container/a.pdf' }, { id: 'missing', uri: 'blob:expired' }], image: { id: 'remote', uri: 'https://example.com/image.png' } } };
  const restored = restoreAttachmentUris(data, [{ id: 'a', uri: 'file:///new-container/a.pdf', name: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 20 }]);
  assert.equal(restored.notes.files[0].uri, 'file:///new-container/a.pdf');
  assert.equal(restored.notes.files[1].uri, '');
  assert.equal(restored.notes.image.uri, 'https://example.com/image.png');
  assert.equal(data.notes.files[0].uri, 'file:///old-container/a.pdf');
});
