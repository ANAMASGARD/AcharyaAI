import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const teachingSessions = sqliteTable(
  'teaching_sessions',
  {
    id: text('id').primaryKey(),
    ownerClerkId: text('owner_clerk_id').notNull(),
    title: text('title').notNull(),
    grade: text('grade'),
    subject: text('subject'),
    status: text('status').notNull().default('draft'),
    localAudioUri: text('local_audio_uri'),
    uploadStatus: text('upload_status').notNull().default('local'),
    revision: integer('revision').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [index('teaching_sessions_owner_idx').on(table.ownerClerkId)],
);

export const syncState = sqliteTable('sync_state', {
  clerkUserId: text('clerk_user_id').primaryKey(),
  pullCursor: text('pull_cursor').notNull().default('0'),
  lastPushAt: text('last_push_at'),
  lastPullAt: text('last_pull_at'),
});

export const syncOutbox = sqliteTable('sync_outbox', {
  id: text('id').primaryKey(),
  clerkUserId: text('clerk_user_id').notNull(),
  operationId: text('operation_id').notNull().unique(),
  entity: text('entity').notNull(),
  op: text('op').notNull(),
  recordId: text('record_id').notNull(),
  baseRevision: integer('base_revision').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt: text('created_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
});
