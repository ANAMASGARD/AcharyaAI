/* global __dirname */
// SELECT-only verification: never creates embeddings or changes shared content.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { neon } = require('@neondatabase/serverless');

async function main() {
  const env = parseEnv(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'));
  const url = env.RAG_DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!url) throw new Error('Set DATABASE_URL in this checkout\'s .env.');
  const sql = neon(url);
  const books = await sql.query(`
    SELECT d.id, d.title, d.catalog_key, d.status,
      d.page_count, d.chunk_count, jsonb_array_length(d.files) chapters,
      (SELECT count(*)::int FROM acharya_rag.pages p WHERE p.document_id=d.id) pages,
      (SELECT count(*)::int FROM acharya_rag.pages p WHERE p.document_id=d.id AND p.outcome='unresolved') unresolved,
      (SELECT count(*)::int FROM acharya_rag.chunks c WHERE c.document_id=d.id) chunks,
      (SELECT count(*)::int FROM acharya_rag.chunks c WHERE c.document_id=d.id AND c.embedding IS NOT NULL) vectors
    FROM acharya_rag.sources s JOIN acharya_rag.documents d ON d.id=s.active_version
    WHERE s.owner IS NULL AND s.deleted_at IS NULL AND COALESCE(d.catalog_key,'') NOT LIKE 'pilot:%' ORDER BY d.title`);
  const diagnosticSources = await sql.query(`SELECT d.title,d.catalog_key,d.page_count,d.chunk_count
    FROM acharya_rag.sources s JOIN acharya_rag.documents d ON d.id=s.active_version
    WHERE s.owner IS NULL AND s.deleted_at IS NULL AND d.catalog_key LIKE 'pilot:%'`);
  const usage = await sql.query(`SELECT count(*)::int calls,
    count(*) FILTER(WHERE model='text-embedding-3-small')::int embedding_calls,
    coalesce(sum(actual_usd),0) measured_usd FROM acharya_rag.provider_usage`);
  const budget = await sql.query('SELECT id,limit_usd,committed_usd FROM acharya_rag.budgets');
  const baseline = await sql.query(`SELECT (SELECT count(*)::int FROM public.users) users,
    (SELECT count(*)::int FROM public.teaching_sessions) teaching_sessions`);
  const profiles = await sql.query(`SELECT DISTINCT d.profile,p.model,p.dimensions
    FROM acharya_rag.sources s JOIN acharya_rag.documents d ON d.id=s.active_version
    JOIN acharya_rag.embedding_profiles p ON p.id=d.profile
    WHERE s.owner IS NULL AND s.deleted_at IS NULL`);
  const unpublished = await sql.query(`SELECT d.title,d.status,d.error
    FROM acharya_rag.sources s JOIN acharya_rag.documents d ON d.source_id=s.id
    WHERE s.owner IS NULL AND s.deleted_at IS NULL AND s.active_version IS NULL`);
  const totals = books.reduce((sum, book) => ({
    books: sum.books + 1, chapters: sum.chapters + book.chapters,
    pages: sum.pages + book.pages, chunks: sum.chunks + book.chunks, vectors: sum.vectors + book.vectors,
  }), { books: 0, chapters: 0, pages: 0, chunks: 0, vectors: 0 });
  const reconciled = books.every(book => book.status === 'ready' && book.unresolved === 0 &&
    book.pages === book.page_count && book.chunks === book.chunk_count && book.vectors === book.chunks) &&
    profiles.every(profile => profile.model === 'text-embedding-3-small' && profile.dimensions === 1536);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), reconciled, totals, books, diagnosticSources, unpublished, usage, budget, baseline, profiles }, null, 2));
  if (!reconciled || !books.length) process.exitCode = 1;
}
main().catch(error => {
  console.error(error.message === "Set DATABASE_URL in this checkout's .env." ? error.message :
    'Read-only Neon verification failed. Check this checkout\'s .env and database connectivity; credentials are not logged.');
  process.exitCode = 1;
});
