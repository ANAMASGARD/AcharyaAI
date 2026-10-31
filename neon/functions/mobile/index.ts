import { createClerkClient } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';
import { requireClerkUserId } from '../../../src/server/db/auth';
import { readRecordingBody } from '../../../src/server/recording/request-body';
import { validateSyncedReport } from '../../../src/lib/reports/sync-contract';

/** Neon Functions entry. No provider secrets or database credentials are shipped to Expo. */
export default { async fetch(request: Request): Promise<Response> {
  const auth = await requireClerkUserId(request);
  if (!auth.ok) return auth.response;
  const path = new URL(request.url).pathname;
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  // Budget is zero. No flag can enable developer-funded calls in this release.
  if (path.endsWith('/ai') || path.includes('/billing') || path.includes('/promo')) return reply({ error: 'DISABLED' }, 403);
  const action = request.method === 'POST' && path.endsWith('/reports') ? 'push'
    : request.method === 'GET' && path.endsWith('/reports') ? 'pull'
    : request.method === 'DELETE' && path.endsWith('/account') ? 'delete' : null;
  if (!action) return reply({ error: 'NOT_FOUND' }, 404);
  const url = process.env.DATABASE_URL;
  if (!url) return reply({ error: 'NOT_CONFIGURED' }, 503);
  let payload: string | null = null, digest: string | null = null;
  const cursor = new URL(request.url).searchParams.get('cursor') ?? '0';
  if (!/^\d{1,18}$/.test(cursor)) return reply({ error: 'INVALID_CURSOR' }, 400);
  if (action === 'push') {
    try {
      const bytes = await readRecordingBody(request, 900_000);
      payload = JSON.stringify(validateSyncedReport(JSON.parse(new TextDecoder().decode(bytes))));
      digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))), b => b.toString(16).padStart(2, '0')).join('');
    } catch { return reply({ error: 'INVALID_REPORT' }, 400); }
  }
  try {
    const sql = neon(url);
    // The login role must be a member of acharya_runtime, never the migration owner.
    // The role, owner, timeouts, mutation, and ack run in one non-interactive HTTP transaction.
    const result = await sql.transaction([
      sql`SET LOCAL ROLE acharya_runtime`,
      sql`SELECT set_config('app.clerk_user_id', ${auth.clerkUserId}, true), set_config('statement_timeout', '8000', true), set_config('lock_timeout', '3000', true)`,
      sql`SELECT acharya.report_operation(${action}, ${payload}::jsonb, ${digest}, ${cursor}::bigint) AS result`,
    ], { fetchOptions: { signal: AbortSignal.timeout(12_000) } });
    if (action === 'delete') {
      // Tombstone commits first. A lost response/retry cannot restore deleted data.
      // Retrying DELETE is allowed even while normal reads/writes are blocked.
      await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.deleteUser(auth.clerkUserId);
    }
    return reply(result[2][0].result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = message.includes('ACCOUNT_DELETED') ? 'ACCOUNT_DELETED'
      : message.includes('RATE_LIMIT') ? 'RATE_LIMIT'
      : message.includes('REPORT_CONFLICT') || message.includes('duplicate key') ? 'REPORT_CONFLICT'
      : message.includes('INVALID_CURSOR') ? 'INVALID_CURSOR' : 'RETRY_LATER';
    return reply({ error: code }, code === 'ACCOUNT_DELETED' ? 403 : code === 'RATE_LIMIT' ? 429 : code === 'REPORT_CONFLICT' ? 409 : code === 'INVALID_CURSOR' ? 400 : 503);
  }
} };
