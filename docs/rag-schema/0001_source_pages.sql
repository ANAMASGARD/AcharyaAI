ALTER TABLE acharya_rag.pages ADD COLUMN IF NOT EXISTS source_page integer;
--> statement-breakpoint
UPDATE acharya_rag.pages SET source_page=number WHERE source_page IS NULL;
--> statement-breakpoint
ALTER TABLE acharya_rag.pages ALTER COLUMN source_page SET NOT NULL;
--> statement-breakpoint
ALTER TABLE acharya_rag.chunks ADD COLUMN IF NOT EXISTS source_page integer;
--> statement-breakpoint
UPDATE acharya_rag.chunks SET source_page=page WHERE source_page IS NULL;
--> statement-breakpoint
ALTER TABLE acharya_rag.chunks ALTER COLUMN source_page SET NOT NULL;
