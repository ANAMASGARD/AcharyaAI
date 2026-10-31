CREATE TABLE `sync_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`entity` text NOT NULL,
	`op` text NOT NULL,
	`record_id` text NOT NULL,
	`base_revision` integer NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_outbox_operation_id_unique` ON `sync_outbox` (`operation_id`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`clerk_user_id` text PRIMARY KEY NOT NULL,
	`pull_cursor` text DEFAULT '0' NOT NULL,
	`last_push_at` text,
	`last_pull_at` text
);
--> statement-breakpoint
CREATE TABLE `teaching_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_clerk_id` text NOT NULL,
	`title` text NOT NULL,
	`grade` text,
	`subject` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`local_audio_uri` text,
	`upload_status` text DEFAULT 'local' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `teaching_sessions_owner_idx` ON `teaching_sessions` (`owner_clerk_id`);