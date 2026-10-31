CREATE TABLE acharya_rag.sources (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21), owner text, identity_key text NOT NULL UNIQUE,
 active_version varchar(21), deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
INSERT INTO acharya_rag.sources(id,owner,identity_key,active_version)
 SELECT id,owner,dedup_key,CASE WHEN status='ready' THEN id ELSE NULL END FROM acharya_rag.documents;
--> statement-breakpoint
ALTER TABLE acharya_rag.documents ADD COLUMN source_id varchar(21) REFERENCES acharya_rag.sources(id),
 ADD COLUMN text_hash text, ADD COLUMN extraction_version text NOT NULL DEFAULT 'page-v1',
 ADD COLUMN chunking_version text NOT NULL DEFAULT 'characters-v1', ADD COLUMN files jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN extracted_count integer NOT NULL DEFAULT 0, ADD COLUMN attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN next_attempt_at timestamptz, ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
UPDATE acharya_rag.documents SET source_id=id,extracted_count=page_count;
--> statement-breakpoint
ALTER TABLE acharya_rag.documents ALTER COLUMN source_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE acharya_rag.documents DROP CONSTRAINT documents_status_check;
--> statement-breakpoint
ALTER TABLE acharya_rag.documents ADD CONSTRAINT documents_status_check CHECK(status IN ('extracting','needs_reupload','pending','processing','ready','failed'));
--> statement-breakpoint
ALTER TABLE acharya_rag.pages ADD COLUMN outcome text NOT NULL DEFAULT 'extracted' CHECK(outcome IN ('extracted','blank','unresolved')), ADD COLUMN printed_label text;
--> statement-breakpoint
INSERT INTO acharya_rag.embedding_profiles VALUES ('openai:text-embedding-3-small:1536:page-v2','openai','text-embedding-3-small',1536,'page-outcomes-v2:cl100k_base:600:80:v2');
--> statement-breakpoint
CREATE TABLE acharya_rag.budgets (
 id text PRIMARY KEY, limit_usd numeric(14,8) NOT NULL CHECK(limit_usd>0), committed_usd numeric(14,8) NOT NULL DEFAULT 0 CHECK(committed_usd>=0)
);
--> statement-breakpoint
INSERT INTO acharya_rag.budgets(id,limit_usd) VALUES ('curriculum-preload-v1',10);
--> statement-breakpoint
CREATE TABLE acharya_rag.provider_usage (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21), budget_id text NOT NULL REFERENCES acharya_rag.budgets(id),
 model text NOT NULL, reserved_usd numeric(14,8) NOT NULL, actual_usd numeric(14,8),
 input_tokens integer, output_tokens integer, status text NOT NULL DEFAULT 'reserved',
 pricing_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE acharya_rag.conversations ADD COLUMN provenance jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE acharya_rag.messages ADD COLUMN request_id text;
--> statement-breakpoint
CREATE UNIQUE INDEX rag_message_request ON acharya_rag.messages(conversation_id,request_id,role) WHERE request_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE acharya_rag.generated_papers (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21), owner text NOT NULL, selections jsonb NOT NULL, paper jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX rag_sources_owner ON acharya_rag.sources(owner);
--> statement-breakpoint
CREATE INDEX rag_documents_source ON acharya_rag.documents(source_id);
