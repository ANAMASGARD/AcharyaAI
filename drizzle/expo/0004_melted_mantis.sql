CREATE TABLE `embedding_accounts` (
	`owner` text PRIMARY KEY NOT NULL,
	`generation` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_vectors` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`contract` text NOT NULL,
	`vector` blob,
	`synced` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `local_reports`(`session_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_vectors_source_idx` ON `report_vectors` (`session_id`,`kind`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `report_vectors_owner_idx` ON `report_vectors` (`owner`);