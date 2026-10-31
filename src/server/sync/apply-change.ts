import { eq } from 'drizzle-orm';

import type { SyncOp, TeachingSessionPayload } from '@/lib/sync/types';
import { teachingSessions } from '@/server/db/schema/sessions';
import { syncChangeLog } from '@/server/db/schema/sync-meta';
import { toTeachingSessionRecord } from '@/server/sync/session-mapper';
import type { getServerDb } from '@/server/db/client';

type Db = ReturnType<typeof getServerDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export async function applyTeachingSessionChange(
  tx: Tx,
  clerkUserId: string,
  op: SyncOp,
  recordId: string,
  payload: TeachingSessionPayload,
): Promise<{ revision: number; record: ReturnType<typeof toTeachingSessionRecord> | null }> {
  const [existing] = await tx
    .select()
    .from(teachingSessions)
    .where(eq(teachingSessions.id, recordId))
    .limit(1);

  if (existing && existing.ownerClerkId !== clerkUserId) {
    throw new Error('FORBIDDEN_OWNER');
  }

  const now = new Date();

  if (op === 'delete') {
    if (!existing) {
      return { revision: 0, record: null };
    }
    const nextRevision = existing.revision + 1;
    const [updated] = await tx
      .update(teachingSessions)
      .set({
        deletedAt: now,
        revision: nextRevision,
        updatedAt: now,
        status: 'deleted',
      })
      .where(eq(teachingSessions.id, recordId))
      .returning();
    await tx.insert(syncChangeLog).values({
      clerkUserId,
      entity: 'teaching_sessions',
      recordId,
      revision: nextRevision,
      op: 'delete',
    });
    return {
      revision: nextRevision,
      record: updated ? toTeachingSessionRecord(updated) : null,
    };
  }

  const title = payload.title?.trim();
  if (!title) {
    throw new Error('INVALID_PAYLOAD');
  }

  if (!existing) {
    const [inserted] = await tx
      .insert(teachingSessions)
      .values({
        id: recordId,
        ownerClerkId: clerkUserId,
        title,
        grade: payload.grade ?? null,
        subject: payload.subject ?? null,
        status: payload.status ?? 'draft',
        localAudioUri: payload.localAudioUri ?? null,
        uploadStatus: payload.uploadStatus ?? 'local',
        revision: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await tx.insert(syncChangeLog).values({
      clerkUserId,
      entity: 'teaching_sessions',
      recordId,
      revision: 1,
      op: 'create',
    });
    return { revision: 1, record: toTeachingSessionRecord(inserted) };
  }

  const nextRevision = existing.revision + 1;
  const [updated] = await tx
    .update(teachingSessions)
    .set({
      title,
      grade: payload.grade ?? null,
      subject: payload.subject ?? null,
      status: payload.status ?? existing.status,
      localAudioUri: payload.localAudioUri ?? existing.localAudioUri,
      uploadStatus: payload.uploadStatus ?? existing.uploadStatus,
      revision: nextRevision,
      updatedAt: now,
      deletedAt: null,
    })
    .where(eq(teachingSessions.id, recordId))
    .returning();

  await tx.insert(syncChangeLog).values({
    clerkUserId,
    entity: 'teaching_sessions',
    recordId,
    revision: nextRevision,
    op: op === 'create' ? 'update' : op,
  });

  return {
    revision: nextRevision,
    record: updated ? toTeachingSessionRecord(updated) : null,
  };
}
