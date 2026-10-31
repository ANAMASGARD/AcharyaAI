CREATE TABLE `recording_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`start_ms` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`local_uri` text NOT NULL,
	`status` text NOT NULL,
	`transcript` text NOT NULL,
	`attempts` integer NOT NULL,
	`next_attempt_at` integer,
	`error` text,
	FOREIGN KEY (`session_id`) REFERENCES `recording_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recording_chunks_sequence_idx` ON `recording_chunks` (`session_id`,`chunk_index`);--> statement-breakpoint
CREATE TABLE `recording_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_clerk_id` text NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`grade` text NOT NULL,
	`started_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`expected_chunk_count` integer NOT NULL,
	`status` text NOT NULL,
	`server_created` integer NOT NULL,
	`server_finalized` integer NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `recording_sessions_owner_idx` ON `recording_sessions` (`owner_clerk_id`);