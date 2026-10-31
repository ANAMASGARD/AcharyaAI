import { eq } from 'drizzle-orm';

import { getLocalDb } from '@/db/client';
import { teachingSessions } from '@/db/schema';
import type { SyncPullChange, TeachingSessionRecord } from '@/lib/sync/types';

type LocalWriter = Pick<ReturnType<typeof getLocalDb>, 'select' | 'insert' | 'update'>;

/** Applies server changes locally — never enqueues outbox rows. */
export async function applyRemoteChanges(changes: SyncPullChange[]): Promise<void> {
  if (changes.length === 0) {
    return;
  }

  const db = getLocalDb();
  await db.transaction(async (tx) => {
    for (const change of changes) {
      if (change.entity !== 'teaching_sessions' || !change.record) {
        continue;
      }
      await upsertTeachingSession(tx, change.record);
    }
  });
}

async function upsertTeachingSession(db: LocalWriter, record: TeachingSessionRecord) {
  const [existing] = await db
    .select()
    .from(teachingSessions)
    .where(eq(teachingSessions.id, record.id))
    .limit(1);

  const values = {
    id: record.id,
    ownerClerkId: record.ownerClerkId,
    title: record.title,
    grade: record.grade,
    subject: record.subject,
    status: record.status,
    localAudioUri: record.localAudioUri,
    uploadStatus: record.uploadStatus,
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };

  if (!existing) {
    await db.insert(teachingSessions).values(values);
    return;
  }

  if (existing.revision > record.revision) {
    return;
  }

  await db.update(teachingSessions).set(values).where(eq(teachingSessions.id, record.id));
}
