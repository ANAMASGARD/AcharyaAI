const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
test('queue migration preserves existing vector bytes and assigns unique FIFO sequence',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  // Minimal pre-migration vector shape with multiple rows, including an acknowledgement.
  db.exec('CREATE TABLE report_vectors(id TEXT PRIMARY KEY,owner TEXT NOT NULL,vector BLOB,synced INTEGER NOT NULL);');
  const insert=db.prepare('INSERT INTO report_vectors VALUES(?,?,?,?)');
  insert.run('older','alice',new Uint8Array([1,2,3,4]),1);insert.run('newer','alice',new Uint8Array([5,6]),0);insert.run('other','bob',null,0);
  db.exec(fs.readFileSync('drizzle/expo/0005_white_leader.sql','utf8'));
  const rows=db.prepare('SELECT id,enqueue_sequence,synced,hex(vector) AS bytes FROM report_vectors ORDER BY enqueue_sequence').all();
  assert.deepEqual(rows.map(row=>[row.id,row.enqueue_sequence,row.synced,row.bytes]),[['older',1,1,'01020304'],['newer',2,0,'0506'],['other',3,0,'']]);
  assert.throws(()=>db.exec("INSERT INTO report_vectors(id,owner,vector,synced,enqueue_sequence) VALUES('duplicate-order','alice',NULL,0,1)"),/UNIQUE/);
 }finally{db.close();}
});
