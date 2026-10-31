import { and, asc, eq, gt } from 'drizzle-orm';

import { getServerDb } from '@/server/db/client';
import { syncChangeLog } from '@/server/db/schema/sync-meta';
import { teachingSessions } from '@/server/db/schema/sessions';
import type { SyncPullResponse } from '@/lib/sync/types';
import { isSyncEntity, isSyncOp } from '@/lib/sync/types';
import { toTeachingSessionRecord } from '@/server/sync/session-mapper';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function handleSyncPull(
  clerkUserId: string,
  cursor: string | null,
  limitParam: string | null,
): Promise<SyncPullResponse> {
  const db = getServerDb();
  const parsedCursor = parseCursor(cursor);
  const limit = parseLimit(limitParam);

  const rows = await db
    .select()
    .from(syncChangeLog)
    .where(and(eq(syncChangeLog.clerkUserId, clerkUserId), gt(syncChangeLog.seq, parsedCursor)))
    .orderBy(asc(syncChangeLog.seq))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const changes = [];
  for (const row of page) {
    if (!isSyncEntity(row.entity) || !isSyncOp(row.op)) {
      continue;
    }

    let record = null;
    if (row.entity === 'teaching_sessions') {
      const [session] = await db
        .select()
        .from(teachingSessions)
        .where(eq(teachingSessions.id, row.recordId))
        .limit(1);
      if (session && session.ownerClerkId === clerkUserId) {
        record = row.op === 'delete' && session.deletedAt
          ? toTeachingSessionRecord(session)
          : session.deletedAt && row.op !== 'delete'
            ? null
            : toTeachingSessionRecord(session);
      }
    }

    changes.push({
      seq: row.seq,
      entity: row.entity,
      op: row.op,
      recordId: row.recordId,
      revision: row.revision,
      record,
    });
  }

  const lastSeq = page.length > 0 ? page[page.length - 1].seq : parsedCursor;
  const nextCursor = String(lastSeq);

  return {
    changes,
    nextCursor,
    hasMore,
  };
}

function parseCursor(cursor: string | null): number {
  if (!cursor) {
    return 0;
  }
  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function parseLimit(limitParam: string | null): number {
  if (!limitParam) {
    return DEFAULT_LIMIT;
  }
  const parsed = Number.parseInt(limitParam, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}
