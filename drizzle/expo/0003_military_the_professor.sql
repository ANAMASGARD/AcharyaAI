CREATE TABLE `report_sync_accounts` (
	`owner` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`cursor` text DEFAULT '0' NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `report_sync_acks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`revision` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `local_reports`(`session_id`) ON UPDATE no action ON DELETE cascade
);
