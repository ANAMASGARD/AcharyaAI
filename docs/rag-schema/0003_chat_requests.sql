ALTER TABLE acharya_rag.conversations ADD COLUMN initial_request text, ADD COLUMN request_token varchar(21), ADD COLUMN request_until timestamptz;
--> statement-breakpoint
CREATE UNIQUE INDEX rag_conversation_initial_request ON acharya_rag.conversations(owner,initial_request) WHERE initial_request IS NOT NULL;
