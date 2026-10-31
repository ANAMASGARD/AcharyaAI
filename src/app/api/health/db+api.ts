import { sql } from 'drizzle-orm';

import { requireClerkUserId } from '@/server/db/auth';
import { getServerDb } from '@/server/db/client';

export async function GET(request: Request) {
  const auth = await requireClerkUserId(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const db = getServerDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, userId: auth.clerkUserId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database check failed';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
