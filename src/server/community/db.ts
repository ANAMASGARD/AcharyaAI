import { neon } from '@neondatabase/serverless';

export type CommunityResult = Record<string, unknown>;

/** Authenticated callers cannot select the service role or supply moderator claims. */
export async function communityOperation(clerkUserId: string, action: string, payload: Record<string, unknown> = {}): Promise<CommunityResult> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('COMMUNITY_NOT_CONFIGURED');
  const moderators = (process.env.COMMUNITY_MODERATOR_IDS ?? '').split(',').map(value => value.trim());
  const sql = neon(url);
  const result = await sql.transaction([
    sql`SET LOCAL ROLE acharya_runtime`,
    sql`SELECT set_config('app.clerk_user_id', ${clerkUserId}, true), set_config('app.community_moderator', ${String(moderators.includes(clerkUserId))}, true), set_config('statement_timeout', '8000', true), set_config('lock_timeout', '3000', true)`,
    sql`SELECT acharya.community_operation(${action}, ${JSON.stringify(payload)}::jsonb) AS result`,
  ], { fetchOptions: { signal: AbortSignal.timeout(12_000) } });
  return result[2][0].result as CommunityResult;
}

/** Called after the existing account tombstone commits, before deleting the Clerk user. */
export async function deleteCommunityAccount(clerkUserId: string): Promise<void> {
  await communityOperation(clerkUserId, 'account_delete');
}

/** Only inject into an authenticated scheduler; never call from a teacher route. */
export async function systemCleanupOperation(_clerkUserId: string, action: string, payload: Record<string, unknown>): Promise<CommunityResult> {
  if (!['media_cleanup_claim', 'media_cleanup_complete', 'media_cleanup_fail'].includes(action)) throw new Error('FORBIDDEN');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('COMMUNITY_NOT_CONFIGURED');
  const sql = neon(url);
  const result = await sql.transaction([
    sql`SET LOCAL ROLE acharya_runtime`,
    sql`SELECT set_config('app.clerk_user_id', 'user_systemCleanup', true), set_config('app.community_cleanup', 'true', true), set_config('statement_timeout', '8000', true), set_config('lock_timeout', '3000', true)`,
    sql`SELECT acharya.community_operation(${action}, ${JSON.stringify(payload)}::jsonb) AS result`,
  ], { fetchOptions: { signal: AbortSignal.timeout(12_000) } });
  return result[2][0].result as CommunityResult;
}
