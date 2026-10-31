import { eq } from 'drizzle-orm';

import { getLocalDb } from '@/db/client';
import { syncState } from '@/db/schema';
import { applyRemoteChanges } from '@/lib/sync/apply-remote';
import { syncPull, syncPush } from '@/lib/sync/api-client';
import {
  listPendingOutbox,
  markOutboxError,
  outboxRowToOperation,
  removeOutboxEntry,
} from '@/lib/sync/outbox';
import type { SyncPushOperation } from '@/lib/sync/types';

export type SyncRunResult =
  | { status: 'success' }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string };

export async function runSync(clerkUserId: string, token: string): Promise<SyncRunResult> {
  try {
    await pushOutbox(clerkUserId, token);
    await pullRemote(clerkUserId, token);
    return { status: 'success' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return { status: 'error', message };
  }
}

async function pushOutbox(clerkUserId: string, token: string) {
  const pending = await listPendingOutbox(clerkUserId);
  if (pending.length === 0) {
    return;
  }

  const operations: SyncPushOperation[] = pending.map(outboxRowToOperation);
  const response = await syncPush(token, { operations });

  for (const result of response.results) {
    switch (result.status) {
      case 'applied':
      case 'duplicate':
        if (result.serverRecord) {
          await applyRemoteChanges([
            {
              seq: 0,
              entity: 'teaching_sessions',
              op: 'update',
              recordId: result.recordId,
              revision: result.serverRecord.revision,
              record: result.serverRecord,
            },
          ]);
        }
        await removeOutboxEntry(result.operationId);
        break;
      case 'conflict':
        if (result.serverRecord) {
          await applyRemoteChanges([
            {
              seq: 0,
              entity: 'teaching_sessions',
              op: 'update',
              recordId: result.recordId,
              revision: result.serverRecord.revision,
              record: result.serverRecord,
            },
          ]);
        }
        await markOutboxError(
          result.operationId,
          `Conflict at revision ${result.revision ?? 'unknown'}`,
        );
        break;
      case 'forbidden':
        await markOutboxError(result.operationId, 'Forbidden');
        break;
      default: {
        const _exhaustive: never = result.status;
        void _exhaustive;
      }
    }
  }
}

async function pullRemote(clerkUserId: string, token: string) {
  const db = getLocalDb();
  const [state] = await db
    .select()
    .from(syncState)
    .where(eq(syncState.clerkUserId, clerkUserId))
    .limit(1);

  let cursor = state?.pullCursor ?? '0';
  let hasMore = true;

  while (hasMore) {
    const page = await syncPull(token, cursor);
    await applyRemoteChanges(page.changes);
    cursor = page.nextCursor;
    hasMore = page.hasMore;
  }

  const now = new Date().toISOString();
  if (state) {
    await db
      .update(syncState)
      .set({ pullCursor: cursor, lastPullAt: now })
      .where(eq(syncState.clerkUserId, clerkUserId));
  } else {
    await db.insert(syncState).values({
      clerkUserId,
      pullCursor: cursor,
      lastPullAt: now,
    });
  }
}
