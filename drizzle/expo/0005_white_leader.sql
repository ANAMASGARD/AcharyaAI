ALTER TABLE `report_vectors` ADD `enqueue_sequence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `report_vectors` SET `enqueue_sequence` = rowid;
--> statement-breakpoint
CREATE UNIQUE INDEX `report_vectors_queue_idx` ON `report_vectors` (`owner`,`enqueue_sequence`);