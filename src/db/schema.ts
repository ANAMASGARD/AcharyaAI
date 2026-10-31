import { customType, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

// Local report history stores generated notes/reflection, never a second raw transcript copy.
export const localReports = sqliteTable('local_reports', {
  sessionId: text('session_id').primaryKey().references(() => recordingSessions.id, { onDelete: 'cascade' }),
  ownerClerkId: text('owner_clerk_id').notNull(),
  title: text('title').notNull(), subject: text('subject').notNull(), grade: text('grade').notNull(),
  recordedAt: text('recorded_at').notNull(), durationMs: integer('duration_ms').notNull(),
  reportJson: text('report_json').notNull(), classNotes: text('class_notes').notNull(),
  model: text('model').notNull(), createdAt: text('created_at').notNull(),
}, (table) => [index('local_reports_owner_date_idx').on(table.ownerClerkId, table.recordedAt)]);

// A saved immutable report is its durable queue item until an acknowledgement exists.
export const reportSyncAccounts = sqliteTable('report_sync_accounts', {
  owner: text('owner').primaryKey(), enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  cursor: text('cursor').notNull().default('0'), lastError: text('last_error'),
});
export const reportSyncAcks = sqliteTable('report_sync_acks', {
  id: text('id').primaryKey().references(() => localReports.sessionId, { onDelete: 'cascade' }),
  owner: text('owner').notNull(), revision: text('revision').notNull(),
});


// Expo SQLite returns Uint8Array; Node Buffer is absent in Hermes.
const vectorBytes = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'blob',
  fromDriver: (value) => new Uint8Array(value),
  toDriver: (value) => value,
});

// Immutable source chunks. Native workers commit every vector for a report together.
export const embeddingAccounts = sqliteTable('embedding_accounts', {
  owner: text('owner').primaryKey(), generation: text('generation').notNull(),
});
export const reportVectors = sqliteTable('report_vectors', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => localReports.sessionId, { onDelete: 'cascade' }),
  owner: text('owner').notNull(), kind: text('kind').$type<'notes' | 'reflection'>().notNull(),
  chunkIndex: integer('chunk_index').notNull(), title: text('title').notNull(), content: text('content').notNull(),
  enqueueSequence: integer('enqueue_sequence').notNull().default(0),
  contract: text('contract').notNull(), vector: vectorBytes('vector'),
  synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
}, table => [uniqueIndex('report_vectors_source_idx').on(table.sessionId, table.kind, table.chunkIndex), index('report_vectors_owner_idx').on(table.owner), uniqueIndex('report_vectors_queue_idx').on(table.owner, table.enqueueSequence)]);
