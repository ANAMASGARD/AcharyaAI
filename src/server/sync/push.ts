import { eq } from 'drizzle-orm';

import { assertAcharyaId } from '@/lib/validate-id';
import type { SyncPushOperation, SyncPushResponse, SyncPushResultItem } from '@/lib/sync/types';
import { isSyncEntity, isSyncOp } from '@/lib/sync/types';
import { getServerDb } from '@/server/db/client';
import { appliedOperations } from '@/server/db/schema/sync-meta';
import { teachingSessions } from '@/server/db/schema/sessions';
import { applyTeachingSessionChange } from '@/server/sync/apply-change';
import { toTeachingSessionRecord } from '@/server/sync/session-mapper';

export async function handleSyncPush(
  clerkUserId: string,
  operations: SyncPushOperation[],
): Promise<SyncPushResponse> {
  const db = getServerDb();
  const results: SyncPushResultItem[] = [];

  for (const operation of operations) {
    results.push(await processOperation(db, clerkUserId, operation));
  }

  return { results };
}

async function findSession(db: ReturnType<typeof getServerDb>, recordId: string) {
  const [row] = await db
    .select()
    .from(teachingSessions)
    .where(eq(teachingSessions.id, recordId))
    .limit(1);
  return row;
}

async function processOperation(
  db: ReturnType<typeof getServerDb>,
  clerkUserId: string,
  operation: SyncPushOperation,
): Promise<SyncPushResultItem> {
  try {
    assertAcharyaId(operation.operationId);
    assertAcharyaId(operation.recordId);
  } catch {
    return {
      operationId: operation.operationId,
      status: 'forbidden',
      recordId: operation.recordId,
    };
  }

  if (!isSyncEntity(operation.entity) || !isSyncOp(operation.op)) {
    return {
      operationId: operation.operationId,
      status: 'forbidden',
      recordId: operation.recordId,
    };
  }

  const [existingOp] = await db
    .select()
    .from(appliedOperations)
    .where(eq(appliedOperations.operationId, operation.operationId))
    .limit(1);

  if (existingOp) {
    if (existingOp.clerkUserId !== clerkUserId) {
      return {
        operationId: operation.operationId,
        status: 'forbidden',
        recordId: operation.recordId,
      };
    }
    const row = await findSession(db, operation.recordId);
    return {
      operationId: operation.operationId,
      status: 'duplicate',
      recordId: operation.recordId,
      revision: row?.revision,
      serverRecord: row ? toTeachingSessionRecord(row) : null,
    };
  }

  if (operation.entity !== 'teaching_sessions') {
    return {
      operationId: operation.operationId,
      status: 'forbidden',
      recordId: operation.recordId,
    };
  }

  const current = await findSession(db, operation.recordId);

  if (current && current.ownerClerkId !== clerkUserId) {
    return {
      operationId: operation.operationId,
      status: 'forbidden',
      recordId: operation.recordId,
    };
  }

  if (current && current.revision !== operation.baseRevision) {
    return {
      operationId: operation.operationId,
      status: 'conflict',
      recordId: operation.recordId,
      revision: current.revision,
      serverRecord: toTeachingSessionRecord(current),
    };
  }

  if (!current && operation.baseRevision !== 0) {
    return {
      operationId: operation.operationId,
      status: 'conflict',
      recordId: operation.recordId,
      revision: 0,
      serverRecord: null,
    };
  }

  try {
    const applied = await db.transaction(async (tx) => {
      const [duplicate] = await tx
        .select()
        .from(appliedOperations)
        .where(eq(appliedOperations.operationId, operation.operationId))
        .limit(1);
      if (duplicate) {
        return { kind: 'duplicate' as const };
      }

      const result = await applyTeachingSessionChange(
        tx,
        clerkUserId,
        operation.op,
        operation.recordId,
        operation.payload,
      );

      await tx.insert(appliedOperations).values({
        operationId: operation.operationId,
        clerkUserId,
      });

      return { kind: 'applied' as const, ...result };
    });

    if (applied.kind === 'duplicate') {
      const row = await findSession(db, operation.recordId);
      return {
        operationId: operation.operationId,
        status: 'duplicate',
        recordId: operation.recordId,
        revision: row?.revision,
        serverRecord: row ? toTeachingSessionRecord(row) : null,
      };
    }

    return {
      operationId: operation.operationId,
      status: 'applied',
      recordId: operation.recordId,
      revision: applied.revision,
      serverRecord: applied.record,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN_OWNER') {
      return {
        operationId: operation.operationId,
        status: 'forbidden',
        recordId: operation.recordId,
      };
    }
    throw error;
  }
}
