const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    { exports, require: name => deps[name], Uint8Array, DataView });
  return exports;
}
const contract = load('src/lib/embeddings/contract.ts');
const sync = load('src/lib/embeddings/sync-contract.ts', { './contract': contract });
const batch = () => ({ reportId: 'a'.repeat(21), chunks: [{ id:'b'.repeat(21),kind:'notes',chunkIndex:0,title:'Plants',content:'Plants use sunlight.',contract:contract.EMBEDDING_CONTRACT,vector:[1,...Array(255).fill(0)] }] });
test('Unicode chunking retains full notes and reflection with bounded overlapping windows', () => {
  const text = 'आज photosynthesis 🪴 '.repeat(100);
  const rows = contract.reportSourceChunks('Plants',text,'Teaching feedback');
  const notes = rows.filter(row => row.kind === 'notes');
  assert.ok(notes.length > 1); assert.ok(rows.every(row => Array.from(row.content).length <= 400));
  const reconstructed = notes.map((row,index) => index ? Array.from(row.content).slice(80).join('') : row.content).join('');
  assert.equal(reconstructed,text.trim());
  assert.equal(rows.at(-1).kind,'reflection');
});
test('vector sync validates contract, finite normalized dimensions and forbids extra owner/transcript fields', () => {
  assert.equal(sync.validateVectorBatch(batch()).chunks.length,1);
  for (const mutate of [b=>b.owner='another-user',b=>b.chunks[0].vector.pop(),b=>b.chunks[0].vector[0]=NaN,
    b=>b.chunks[0].vector[0]=2,b=>b.chunks[0].contract='another-model',b=>b.chunks.push(b.chunks[0])]) {
    const value=batch(); mutate(value); assert.throws(()=>sync.validateVectorBatch(value));
  }
});
test('stored vectors decode little endian without assuming buffer alignment', () => {
  const bytes = new Uint8Array(1026); new DataView(bytes.buffer).setFloat32(2,1,true);
  const values=sync.decodeStoredVector(bytes.subarray(2));
  assert.equal(values[0],1); assert.equal(values.length,256);
  assert.throws(()=>sync.decodeStoredVector(bytes));
});

test('mobile vector BLOB decoding produces Uint8Array without a Buffer global', () => {
  const schemaExports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/db/schema.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    { exports: schemaExports, require: name => require(name), Uint8Array, Buffer: undefined });
  const input = new Uint8Array(1024); new DataView(input.buffer).setFloat32(0, 1, true);
  const value = schemaExports.reportVectors.vector.mapFromDriverValue(input);
  assert.ok(value instanceof Uint8Array); assert.equal(value.length, 1024);
  assert.equal(new DataView(value.buffer).getFloat32(0,true),1);
});
