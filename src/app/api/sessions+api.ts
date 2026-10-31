import { desc, eq } from 'drizzle-orm';

import { requireClerkUserId } from '@/server/db/auth';
import { getServerDb } from '@/server/db/client';
import { teachingSessions } from '@/server/db/schema/sessions';
import { toTeachingSessionRecord } from '@/server/sync/session-mapper';

export async function GET(request: Request) {
  const auth = await requireClerkUserId(request);
  if (!auth.ok) {
    return auth.response;
  }

  const db = getServerDb();
  const rows = await db
    .select()
    .from(teachingSessions)
    .where(eq(teachingSessions.ownerClerkId, auth.clerkUserId))
    .orderBy(desc(teachingSessions.updatedAt))
    .limit(50);

  return Response.json({
    sessions: rows.map(toTeachingSessionRecord),
  });
}
