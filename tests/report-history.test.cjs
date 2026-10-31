const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const { drizzle } = require('../node_modules/drizzle-orm/expo-sqlite/driver.cjs');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, Error, JSON, require: name => name in mocks ? mocks[name] : require(name) });
  return exports;
}
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of fs.readdirSync('drizzle/expo').filter(f => f.endsWith('.sql')).sort()) sqlite.exec(fs.readFileSync(`drizzle/expo/${file}`, 'utf8'));
  const schema = load('src/db/schema.ts', {});
  const db = drizzle({ prepareSync(sql) { return {
    executeSync(params) { const stmt = sqlite.prepare(sql); const result = stmt.run(...params); return { ...result, getAllSync: () => stmt.all(...params), getFirstSync: () => stmt.get(...params) }; },
    executeForRawResultSync(params) { const stmt = sqlite.prepare(sql); stmt.setReturnArrays(true); return { getAllSync: () => stmt.all(...params) }; },
  }; } }, { schema });
  const indexing = load('src/lib/embeddings/indexing.ts', { 'expo': { isRunningInExpoGo: () => true }, 'react-native': { Platform: { OS: 'web' } },
    '@/db/ready': { readyLocalDb: async () => db }, '@/db/schema': schema, '@/lib/id': { createId: () => require('node:crypto').randomBytes(16).toString('base64url').slice(0,21) },
    './contract': load('src/lib/embeddings/contract.ts', {}) });
  const history = load('src/lib/reports/history.ts', { '@/lib/embeddings/indexing': indexing, '@/db/ready': { readyLocalDb: async () => db }, '@/db/schema': schema,
    '@/lib/ai/class-report': { parseTeachingReport: JSON.parse }, '@/lib/validate-id': { assertAcharyaId: () => {} } });
  const session = { id: 'a'.repeat(21), ownerClerkId: 'alice', title: 'Plants', subject: 'Science', grade: '6', startedAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-12T10:01:00Z', durationMs: 60000, expectedChunkCount: 2, status: 'complete', serverCreated: true, serverFinalized: true, error: null };
  db.insert(schema.recordingSessions).values(session).run();
  return { sqlite, history, session, close: () => sqlite.close() };
}
const result = { report: { overallScore: 70, classroomEnvironment: 'Calm', whatWentWrong: 'None', areasToImprove: 'More examples', topicSpecificFeedback: 'Plants' }, classNotes: 'Plants use sunlight.', model: 'gpt-6-luna' };
test('real SQLite history is idempotent, owner-scoped and cascades deletion', async () => {
  const h = setup();
  try {
    await h.history.saveReportHistory('alice', h.session, result, new AbortController().signal);
    await h.history.saveReportHistory('alice', h.session, result, new AbortController().signal);
    const rows = await h.history.listReportHistory('alice');
    assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM report_vectors').get().n, 2);
    assert.equal(rows.length, 1); assert.equal(rows[0].durationSeconds, 60); assert.equal(rows[0].recordedAt, h.session.startedAt);
    assert.equal((await h.history.listReportHistory('bob')).length, 0);
    assert.equal(await h.history.readReportHistory('bob', h.session.id), null);
    const detail = await h.history.readReportHistory('alice', h.session.id);
    assert.equal(detail.classNotes, result.classNotes); assert.equal(detail.transcriptPreview, null);
    await assert.rejects(h.history.saveReportHistory('bob', h.session, result, new AbortController().signal), /owner/);
    h.sqlite.prepare('DELETE FROM recording_sessions WHERE id=?').run(h.session.id);
    assert.equal((await h.history.listReportHistory('alice')).length, 0);
    assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM report_vectors').get().n, 0);
  } finally { h.close(); }
});
test('cancelled and deleted sessions cannot recreate report history', async () => {
  const h = setup();
  try {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(h.history.saveReportHistory('alice', h.session, result, controller.signal), /cancelled/);
    h.sqlite.prepare('DELETE FROM recording_sessions WHERE id=?').run(h.session.id);
    await assert.rejects(h.history.saveReportHistory('alice', h.session, result, new AbortController().signal), /no longer/);
    assert.equal((await h.history.listReportHistory('alice')).length, 0);
    assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM report_vectors').get().n, 0);
  } finally { h.close(); }
});
