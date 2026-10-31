import type { teachingSessions } from '@/server/db/schema/sessions';
import type { TeachingSessionRecord } from '@/lib/sync/types';

type SessionRow = typeof teachingSessions.$inferSelect;

export function toTeachingSessionRecord(row: SessionRow): TeachingSessionRecord {
  return {
    id: row.id,
    ownerClerkId: row.ownerClerkId,
    title: row.title,
    grade: row.grade ?? null,
    subject: row.subject ?? null,
    status: row.status,
    localAudioUri: row.localAudioUri ?? null,
    uploadStatus: row.uploadStatus,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}
