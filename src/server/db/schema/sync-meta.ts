import { bigint, bigserial, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const appliedOperations = pgTable('applied_operations', {
  operationId: varchar('operation_id', { length: 21 }).primaryKey(),
  clerkUserId: text('clerk_user_id').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
});

export const syncChangeLog = pgTable(
  'sync_change_log',
  {
    seq: bigserial('seq', { mode: 'number' }).primaryKey(),
    clerkUserId: text('clerk_user_id').notNull(),
    entity: text('entity').notNull(),
    recordId: varchar('record_id', { length: 21 }).notNull(),
    revision: bigint('revision', { mode: 'number' }).notNull(),
    op: text('op').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sync_change_log_clerk_seq_idx').on(table.clerkUserId, table.seq)],
);
