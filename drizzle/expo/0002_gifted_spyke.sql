CREATE TABLE `local_reports` (
	`session_id` text PRIMARY KEY NOT NULL,
	`owner_clerk_id` text NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`grade` text NOT NULL,
	`recorded_at` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`report_json` text NOT NULL,
	`class_notes` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `recording_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `local_reports_owner_date_idx` ON `local_reports` (`owner_clerk_id`,`recorded_at`);