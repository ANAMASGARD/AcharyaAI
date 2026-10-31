import { and, eq, isNull } from 'drizzle-orm';

import { getLocalDb } from '@/db/client';
import { syncOutbox, syncState, teachingSessions } from '@/db/schema';
import { createId } from '@/lib/id';
import { enqueueTeachingSessionChange } from '@/lib/sync/outbox';
import type { TeachingSessionPayload } from '@/lib/sync/types';

export async function createLocalTeachingSession(
  clerkUserId: string,
  input: TeachingSessionPayload,
): Promise<{ id: string }> {
  const db = getLocalDb();
  const id = createId();
  const now = new Date().toISOString();

  const payload: TeachingSessionPayload = {
    title: input.title,
    grade: input.grade ?? null,
    subject: input.subject ?? null,
    status: input.status ?? 'draft',
    localAudioUri: input.localAudioUri ?? null,
    uploadStatus: input.uploadStatus ?? 'local',
  };

  await db.transaction(async (tx) => {
    await tx.insert(teachingSessions).values({
      id,
      ownerClerkId: clerkUserId,
      title: payload.title,
      grade: payload.grade ?? null,
      subject: payload.subject ?? null,
      status: payload.status ?? 'draft',
      localAudioUri: payload.localAudioUri ?? null,
      uploadStatus: payload.uploadStatus ?? 'local',
      revision: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await enqueueTeachingSessionChange(tx, clerkUserId, 'create', id, 0, payload);
  });

  return { id };
}

export async function listLocalTeachingSessions(clerkUserId: string) {
  const db = getLocalDb();
  return db
    .select()
    .from(teachingSessions)
    .where(and(eq(teachingSessions.ownerClerkId, clerkUserId), isNull(teachingSessions.deletedAt)));
}

export async function clearLocalUserData(clerkUserId: string) {
  const db = getLocalDb();
  await db.transaction(async (tx) => {
    await tx.delete(teachingSessions).where(eq(teachingSessions.ownerClerkId, clerkUserId));
    await tx.delete(syncState).where(eq(syncState.clerkUserId, clerkUserId));
    await tx.delete(syncOutbox).where(eq(syncOutbox.clerkUserId, clerkUserId));
  });
}
