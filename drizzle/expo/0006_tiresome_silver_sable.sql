ALTER TABLE `recording_chunks` ADD `detected_language` text;--> statement-breakpoint
ALTER TABLE `recording_sessions` ADD `stt_backend` text DEFAULT 'gnani' NOT NULL;--> statement-breakpoint
ALTER TABLE `recording_sessions` ADD `stt_model_id` text;--> statement-breakpoint
ALTER TABLE `recording_sessions` ADD `stt_language` text DEFAULT 'en-IN' NOT NULL;