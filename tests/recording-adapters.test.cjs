const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function moduleFrom(file, mocks, extra = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { if (!(name in mocks)) throw Error(name); return mocks[name]; }, URL, AbortController, setTimeout, clearTimeout, ...extra });
  return exports;
}
const types = moduleFrom('src/lib/recording/types.ts', {});
function adapter(fetcher, exists = true) {
  return moduleFrom('src/lib/recording/api.ts', {
    'expo-file-system': { File: class extends Blob { constructor() { super(['wav']); this.exists = exists; } } },
    'expo/fetch': { fetch: fetcher },
    '@/lib/api-origin': { getApiOrigin: () => 'https://app.example' },
    './types': types,
  }, { FormData });
}
const chunk = { id: 'a'.repeat(21), sessionId: 'b'.repeat(21), index: 0, startMs: 0, durationMs: 30_000, localUri: 'file:///audio.wav' };
const success = { chunkId: chunk.id, chunkIndex: 0, transcript: 'hello hello', status: 'done' };
test('mobile adapter sends fresh auth and multipart metadata, preserving repeated speech', async () => {
  const calls = [];
  const api = adapter(async (url, options) => { calls.push({ url, options }); return Response.json(success); }).createRecordingApi(async () => 'fresh-token');
  const result = await api.transcribe(chunk, new AbortController().signal);
  assert.equal(result.transcript, 'hello hello');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer fresh-token');
  assert.equal(calls[0].options.body.get('durationMs'), '30000');
  assert.equal(calls[0].options.body.get('audio').name, `${chunk.id}.wav`);
});
test('adapter rejects response for a different chunk and malformed status', async () => {
  for (const response of [{ ...success, chunkId: 'wrong' }, { ...success, status: 'pending' }, { ...success, transcript: '' }]) {
    const api = adapter(async () => Response.json(response)).createRecordingApi(async () => 'token');
    await assert.rejects(api.transcribe(chunk, new AbortController().signal), /invalid segment/);
  }
});
test('adapter retains structured retry errors; missing file and signed-out calls do not send', async () => {
  const api = adapter(async () => Response.json({ error: { code: 'busy', message: 'Busy', retryable: true, retryAfterMs: 4000 } }, { status: 429 })).createRecordingApi(async () => 'token');
  await assert.rejects(api.transcribe(chunk, new AbortController().signal), error => error.retryable && error.retryAfterMs === 4000);
  let calls = 0;
  const fetcher = async () => { calls++; return Response.json(success); };
  await assert.rejects(adapter(fetcher, false).createRecordingApi(async () => 'token').transcribe(chunk, new AbortController().signal), /missing/);
  await assert.rejects(adapter(fetcher).createRecordingApi(async () => null).transcribe(chunk, new AbortController().signal), /Sign in/);
  assert.equal(calls, 0);
});
test('already canceled adapter request never uploads', async () => {
  let calls = 0;
  const controller = new AbortController(); controller.abort();
  const api = adapter(async () => { calls++; return Response.json(success); }).createRecordingApi(async () => 'token');
  await assert.rejects(api.transcribe(chunk, controller.signal), /interrupted/);
  assert.equal(calls, 0);
});
test('SQLite recording migrations enforce ordered unique chunks and cascading deletion', () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of fs.readdirSync('drizzle/expo').filter(name => name.endsWith('.sql')).sort()) db.exec(fs.readFileSync(`drizzle/expo/${file}`, 'utf8'));
  db.prepare('INSERT INTO recording_sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('s', 'owner', 'topic', 'subject', 'grade', 'now', 'now', 30000, 1, 'partial', 0, 0, null);
  const insert = db.prepare('INSERT INTO recording_chunks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insert.run('c', 's', 0, 0, 30000, 'uri', 'pending', '', 0, null, null);
  assert.throws(() => insert.run('c2', 's', 0, 0, 30000, 'uri', 'pending', '', 0, null, null), /UNIQUE/);
  assert.throws(() => insert.run('c3', 'missing', 1, 0, 30000, 'uri', 'pending', '', 0, null, null), /FOREIGN KEY/);
  db.prepare('DELETE FROM recording_sessions WHERE id = ?').run('s');
  assert.equal(db.prepare('SELECT count(*) AS total FROM recording_chunks').get().total, 0);
  db.close();
});
test('web repository has no native imports and cleanup is safe', async () => {
  const repo = moduleFrom('src/lib/recording/repository.web.ts', {}).recordingRepository;
  assert.equal(await repo.loadLatest('owner'), null);
  await repo.clearAccount('owner');
  await assert.rejects(repo.writeAudio('owner', 'chunk', new Uint8Array()), /Android and iOS/);
});
function fileRepository(freeSpace = 100_000_000) {
  const files = new Set();
  const dirs = new Set();
  class Directory {
    constructor(...parts) { this.uri = parts.map(part => part.uri ?? part).join('/'); }
    get exists() { return dirs.has(this.uri); }
    create() { dirs.add(this.uri); }
    delete() { dirs.delete(this.uri); }
  }
  class File {
    constructor(...parts) { this.uri = parts.map(part => part.uri ?? part).join('/'); }
    get exists() { return files.has(this.uri); }
    create() { if (this.exists) throw Error('exists'); files.add(this.uri); }
    writeSync() {}
    delete() { files.delete(this.uri); }
  }
  const { recordingRepository } = moduleFrom('src/lib/recording/repository.ts', {
    'drizzle-orm': {}, 'drizzle-orm/expo-sqlite/migrator': {},
    'expo-file-system': { File, Directory, Paths: { document: 'file:///documents', availableDiskSpace: freeSpace } },
    '@/db/ready': {}, '@/db/schema': {},
    './native-capture': { clearNativeCapture: async () => {} },
    '@/lib/validate-id': { assertAcharyaId: value => { if (!/^[A-Za-z0-9_-]{21}$/.test(value)) throw Error('Invalid ID'); return value; } },
  });
  return { repo: recordingRepository, files };
}
test('audio storage refuses foreign and traversal paths; deletion is idempotent', async () => {
  const { repo, files } = fileRepository();
  const uri = await repo.writeAudio('user_a', chunk.id, new Uint8Array(10));
  assert.ok(files.has(uri));
  await assert.rejects(repo.deleteAudio('user_b', uri), /does not belong/);
  await assert.rejects(repo.deleteAudio('user_a', 'file:///documents/recordings/user_a/../other.wav'), /does not belong/);
  await assert.rejects(repo.writeAudio('../escape', chunk.id, new Uint8Array(10)), /Invalid recording owner/);
  await assert.rejects(repo.writeAudio('user_a', chunk.id, new Uint8Array(10)), /exists/);
  await repo.deleteAudio('user_a', uri);
  await repo.deleteAudio('user_a', uri);
  assert.equal(files.size, 0);
});
test('audio persistence fails safely with low storage', async () => {
  const { repo, files } = fileRepository(1024);
  await assert.rejects(repo.writeAudio('user_a', chunk.id, new Uint8Array(10)), /Not enough storage/);
  assert.equal(files.size, 0);
});
test('token refresh cancellation is bounded and auth rejection is not retried', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return Response.json(success); };
  const api = adapter(fetcher).createRecordingApi(() => new Promise(() => {}));
  const controller = new AbortController();
  const upload = api.transcribe(chunk, controller.signal);
  controller.abort();
  await assert.rejects(upload, /interrupted/);
  for (const status of [401, 403]) {
    await assert.rejects(adapter(fetcher).createRecordingApi(async () => { throw { status }; }).transcribe(chunk, new AbortController().signal), error => !error.retryable && /Sign in/.test(error.message));
  }
  await assert.rejects(adapter(fetcher).createRecordingApi(async () => { throw new TypeError('Network failed'); }).transcribe(chunk, new AbortController().signal), error => error.retryable);
  assert.equal(calls, 0);
});

test('actual repository enforces owner isolation and drains queued saves before account cleanup', async () => {
  const tables = { sessions: [], chunks: [], reports: [] };
  const schema = {};
  for (const [name, fields] of [['recordingSessions', ['id', 'ownerClerkId', 'startedAt']], ['recordingChunks', ['id', 'sessionId', 'index']]]) {
    schema[name] = { name: name === 'recordingSessions' ? 'sessions' : 'chunks' };
    for (const key of fields) schema[name][key] = key;
  }
  schema.localReports = { name: 'reports', ownerClerkId: 'ownerClerkId' };
  const db = {
    select() {
      let rows;
      const query = { from(table) { rows = tables[table.name]; return query; }, where(predicate) { rows = rows.filter(predicate); return query; },
        orderBy() { return query; }, limit(n) { return Promise.resolve(rows.slice(0, n)); }, all() { return rows; },
        then(resolve) { return Promise.resolve(rows.map(row => ({ ...row }))).then(resolve); } };
      return query;
    },
    insert(table) { return { values(row) { return { async onConflictDoUpdate() {
      const rows = tables[table.name]; const index = rows.findIndex(value => value.id === row.id);
      if (index >= 0) rows[index] = { ...row }; else rows.push({ ...row });
    } }; } }; },
    delete(table) { return { where(predicate) { return { run() { tables[table.name] = tables[table.name].filter(row => !predicate(row)); } }; } }; },
    transaction(fn) { fn(db); },
  };
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const repo = moduleFrom('src/lib/recording/repository.ts', {
    'drizzle-orm': { eq: (key, value) => row => row[key] === value, and: (...filters) => row => filters.every(fn => fn(row)), asc: value => value, desc: value => value },
    'drizzle-orm/expo-sqlite/migrator': { migrate: () => gate },
    'expo-file-system': { Directory: class { constructor(...parts) { this.uri = parts.join('/'); } exists = false; }, Paths: { document: 'file:///documents' } },
    '@/db/ready': { readyLocalDb: async () => { await gate; return db; } }, '@/db/schema': schema,
    './native-capture': { clearNativeCapture: async () => {} },
    '@/lib/validate-id': { assertAcharyaId: value => value },
  }).recordingRepository;
  const session = { id: 's'.repeat(21), ownerClerkId: 'user_a', startedAt: 'now' };
  const other = { id: 't'.repeat(21), ownerClerkId: 'user_b', startedAt: 'now' };
  const firstSave = repo.saveSession(session);
  const otherSave = repo.saveSession(other);
  const firstChunk = repo.saveChunk('user_a', { ...chunk, sessionId: session.id, localUri: '' });
  const cleanup = repo.clearAccount('user_a');
  release();
  await Promise.all([firstSave, otherSave, firstChunk, cleanup]);
  assert.equal(await repo.loadLatest('user_a'), null);
  assert.equal((await repo.loadLatest('user_b')).session.id, other.id);
  assert.equal(tables.chunks.length, 0);
  await assert.rejects(repo.saveSession({ ...other, ownerClerkId: 'user_a' }), /owner mismatch/);
  await assert.rejects(repo.saveChunk('user_a', { ...chunk, sessionId: other.id, localUri: '' }), /unavailable/);
});
