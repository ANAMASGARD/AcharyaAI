import { eq } from 'drizzle-orm';

import { getLocalDb } from '@/db/client';
import { syncOutbox } from '@/db/schema';
import { createId } from '@/lib/id';
import type { SyncOp, SyncPushOperation, TeachingSessionPayload } from '@/lib/sync/types';

type LocalWriter = Pick<ReturnType<typeof getLocalDb>, 'insert'>;

export async function enqueueTeachingSessionChange(
  db: LocalWriter,
  clerkUserId: string,
  op: SyncOp,
  recordId: string,
  baseRevision: number,
  payload: TeachingSessionPayload,
): Promise<SyncPushOperation> {
  const operationId = createId();
  const now = new Date().toISOString();

  const operation: SyncPushOperation = {
    operationId,
    entity: 'teaching_sessions',
    op,
    recordId,
    baseRevision,
    payload,
  };

  await db.insert(syncOutbox).values({
    id: createId(),
    clerkUserId,
    operationId,
    entity: operation.entity,
    op: operation.op,
    recordId: operation.recordId,
    baseRevision: operation.baseRevision,
    payloadJson: JSON.stringify(operation.payload),
    createdAt: now,
  });

  return operation;
}

export async function listPendingOutbox(clerkUserId: string) {
  const db = getLocalDb();
  return db.select().from(syncOutbox).where(eq(syncOutbox.clerkUserId, clerkUserId));
}

export async function removeOutboxEntry(operationId: string) {
  const db = getLocalDb();
  await db.delete(syncOutbox).where(eq(syncOutbox.operationId, operationId));
}

export async function markOutboxError(operationId: string, message: string) {
  const db = getLocalDb();
  const rows = await db
    .select()
    .from(syncOutbox)
    .where(eq(syncOutbox.operationId, operationId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return;
  }
  await db
    .update(syncOutbox)
    .set({
      attempts: row.attempts + 1,
      lastError: message,
    })
    .where(eq(syncOutbox.operationId, operationId));
}

export function outboxRowToOperation(row: typeof syncOutbox.$inferSelect): SyncPushOperation {
  return {
    operationId: row.operationId,
    entity: 'teaching_sessions',
    op: row.op as SyncPushOperation['op'],
    recordId: row.recordId,
    baseRevision: row.baseRevision,
    payload: JSON.parse(row.payloadJson) as TeachingSessionPayload,
  };
}
