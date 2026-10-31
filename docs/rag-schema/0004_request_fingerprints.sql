ALTER TABLE acharya_rag.messages ADD COLUMN request_hash text;
--> statement-breakpoint
ALTER TABLE acharya_rag.verifications ADD COLUMN attempts integer NOT NULL DEFAULT 0, ADD COLUMN next_attempt_at timestamptz;
