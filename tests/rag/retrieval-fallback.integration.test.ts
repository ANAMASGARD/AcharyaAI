import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { expect,it,vi } from 'vitest';
import { query } from '@/server/rag/db';
import { retrieve } from '@/server/rag/retrieve';
import { RagError } from '@/server/rag/contracts';
vi.mock('@/server/rag/openai',()=>({embedTexts:vi.fn(async()=>{throw new RagError('Synthetic outage',503)}),structured:vi.fn()}));
it.skipIf(process.env.RAG_READONLY_CHECK!=='1')('retrieves saved curriculum during an embedding outage, without any provider calls',async()=>{
 Object.assign(process.env,parseEnv(fs.readFileSync('.env','utf8')));
 const [book]=await query<{id:string}>("select d.id from acharya_rag.documents d join acharya_rag.sources s on s.active_version=d.id where d.owner is null and d.title='Mridang' and d.status='ready' and s.deleted_at is null limit 1");
 expect(book).toBeDefined();
 const evidence=await retrieve('read-only-probe','bird family water school',[{documentId:book.id,role:'syllabus'}]);
 expect(evidence.length).toBeGreaterThan(0);expect(evidence.every(c=>c.documentId===book.id&&c.page>0&&c.text.length>0)).toBe(true);
});
