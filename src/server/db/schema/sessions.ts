import { bigint, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const teachingSessions = pgTable('teaching_sessions', {
  id: varchar('id', { length: 21 }).primaryKey(),
  ownerClerkId: text('owner_clerk_id').notNull(),
  title: text('title').notNull(),
  grade: text('grade'),
  subject: text('subject'),
  status: text('status').notNull().default('draft'),
  localAudioUri: text('local_audio_uri'),
  uploadStatus: text('upload_status').notNull().default('local'),
  revision: bigint('revision', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [index('teaching_sessions_owner_idx').on(table.ownerClerkId)]);
