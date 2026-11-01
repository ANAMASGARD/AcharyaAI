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

test('two transcript-only classes reopen by owner, then gain one report without replacing transcripts', async () => {
  const h = setup();
  try {
    const columns = 'id,owner_clerk_id,title,subject,grade,started_at,updated_at,duration_ms,expected_chunk_count,status,server_created,server_finalized';
    h.sqlite.prepare(`INSERT INTO recording_sessions (${columns}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run('b'.repeat(21), 'alice', 'Fractions', 'Math', '6', '2026-10-12T11:00:00Z', '2026-10-12T11:01:00Z', 5000, 1, 'complete', 1, 1);
    const insert = h.sqlite.prepare('INSERT INTO recording_chunks (id,session_id,chunk_index,start_ms,duration_ms,local_uri,status,transcript,attempts) VALUES (?,?,?,?,?,?,?,?,?)');
    insert.run('c'.repeat(21), h.session.id, 0, 0, 30000, '', 'done', 'Plants make food.', 1);
    insert.run('d'.repeat(21), 'b'.repeat(21), 0, 0, 5000, '', 'done', 'One half.', 1);
    const before = await h.history.listClassHistory('alice'); assert.equal(before.length, 2); assert.ok(before.every(s => s.score === undefined));
    assert.equal((await h.history.listClassHistory('bob')).length, 0);
    assert.equal(await h.history.readClassHistory('bob', h.session.id), null);
    for (const id of [h.session.id, 'b'.repeat(21)]) {
      const detail = await h.history.readClassHistory('alice', id); assert.equal(detail.report, null); assert.ok(detail.transcript); assert.equal(detail.recording.session.sttBackend, 'gnani');
    }
    await h.history.saveReportHistory('alice', h.session, result, new AbortController().signal);
    assert.equal((await h.history.listClassHistory('alice')).length, 2);
    const after = await h.history.readClassHistory('alice', h.session.id);
    assert.equal(after.transcript, 'Plants make food.'); assert.equal(after.report.overallScore, 70);
    assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM recording_chunks').get().n, 2);
  } finally { h.close(); }
});

test('offline reports and their index sources save atomically and remain private until owner shares', async () => {
  const h = setup();
  try {
    await h.history.saveReportHistory('alice', h.session, { ...result, backend: 'offline', sourceHash: 'hash', promptVersion: 'classroom-v1' }, new AbortController().signal);
    assert.equal(await h.history.reportSharingAllowed('alice', h.session.id), false);
    assert.ok(h.sqlite.prepare('SELECT count(*) AS n FROM report_vectors').get().n > 0);
    await h.history.allowReportSharing('bob', h.session.id);
    assert.equal(await h.history.reportSharingAllowed('alice', h.session.id), false);
    const cancelled = new AbortController(); cancelled.abort();
    await assert.rejects(h.history.allowReportSharing('alice', h.session.id, cancelled.signal), /cancelled/);
    await h.history.allowReportSharing('alice', h.session.id);
    assert.equal(await h.history.reportSharingAllowed('alice', h.session.id), true);
    const reopened = await h.history.readSavedReportResult('alice', h.session.id);
    assert.equal(reopened.backend, 'offline'); assert.equal(reopened.sourceHash, 'hash');
  } finally { h.close(); }
});
