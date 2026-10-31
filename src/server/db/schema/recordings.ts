import { check, index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Kept outside the general metadata sync protocol: only recording APIs may write these rows.
export const recordingSessions = pgTable('recording_sessions', {
  id: varchar('id', { length: 21 }).primaryKey(),
  ownerClerkId: text('owner_clerk_id').notNull(),
  title: text('title').notNull(), subject: text('subject').notNull(), grade: text('grade').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('recording'),
  durationMs: integer('duration_ms').notNull().default(0),
  expectedChunkCount: integer('expected_chunk_count').notNull().default(0),
}, (t) => [index('recording_sessions_owner_idx').on(t.ownerClerkId), check('recording_sessions_nonnegative', sql`${t.durationMs} >= 0 AND ${t.expectedChunkCount} >= 0`)]);

export const recordingChunks = pgTable('recording_chunks', {
  id: varchar('id', { length: 21 }).primaryKey(),
  sessionId: varchar('session_id', { length: 21 }).notNull().references(() => recordingSessions.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(), startMs: integer('start_ms').notNull(), durationMs: integer('duration_ms').notNull(),
  claimToken: text('claim_token'), leaseUntil: timestamp('lease_until', { withTimezone: true }),
  audioHash: text('audio_hash').notNull(), status: text('status').notNull().default('pending'),
  transcript: text('transcript').notNull().default(''), attempts: integer('attempts').notNull().default(0),
  errorCode: text('error_code'), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('recording_chunks_session_sequence_idx').on(t.sessionId, t.chunkIndex), check('recording_chunks_bounds', sql`${t.chunkIndex} >= 0 AND ${t.startMs} >= 0 AND ${t.durationMs} > 0 AND ${t.durationMs} <= 30000`)]);

export const recordingRateLimits = pgTable('recording_rate_limits', {
  ownerClerkId: text('owner_clerk_id').primaryKey(),
  lastRequestAt: timestamp('last_request_at', { withTimezone: true }).notNull().defaultNow(),
});
