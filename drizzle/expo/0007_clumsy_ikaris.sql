CREATE TABLE `report_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`session_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`stage` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `recording_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_checkpoint_stage_idx` ON `report_checkpoints` (`owner`,`session_id`,`fingerprint`,`stage`);--> statement-breakpoint
ALTER TABLE `local_reports` ADD `backend` text DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE `local_reports` ADD `cloud_share_allowed` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `local_reports` ADD `source_hash` text;--> statement-breakpoint
ALTER TABLE `local_reports` ADD `prompt_version` text;