import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

// Recorder data is independent of the later bidirectional metadata sync.
export const recordingSessions = sqliteTable('recording_sessions', {
  id: text('id').primaryKey(),
  ownerClerkId: text('owner_clerk_id').notNull(),
  title: text('title').notNull(), subject: text('subject').notNull(), grade: text('grade').notNull(),
  startedAt: text('started_at').notNull(), updatedAt: text('updated_at').notNull(),
  durationMs: integer('duration_ms').notNull(), expectedChunkCount: integer('expected_chunk_count').notNull(),
  status: text('status').$type<import('../lib/recording/types').RecordingStatus>().notNull(),
  serverCreated: integer('server_created', { mode: 'boolean' }).notNull(),
  serverFinalized: integer('server_finalized', { mode: 'boolean' }).notNull(),
  error: text('error'),
}, (table) => [index('recording_sessions_owner_idx').on(table.ownerClerkId)]);

export const recordingChunks = sqliteTable('recording_chunks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => recordingSessions.id, { onDelete: 'cascade' }),
  index: integer('chunk_index').notNull(), startMs: integer('start_ms').notNull(), durationMs: integer('duration_ms').notNull(),
  localUri: text('local_uri').notNull(),
  status: text('status').$type<import('../lib/recording/types').ChunkStatus>().notNull(),
  transcript: text('transcript').notNull(), attempts: integer('attempts').notNull(),
  nextAttemptAt: integer('next_attempt_at'), error: text('error'),
}, (table) => [uniqueIndex('recording_chunks_sequence_idx').on(table.sessionId, table.index)]);
