CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS acharya_rag;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS acharya_rag.embedding_profiles (id text PRIMARY KEY, provider text NOT NULL, model text NOT NULL, dimensions integer NOT NULL, pipeline_version text NOT NULL);
--> statement-breakpoint
INSERT INTO acharya_rag.embedding_profiles VALUES ('openai:text-embedding-3-small:1536:page-v1','openai','text-embedding-3-small',1536,'page-v1') ON CONFLICT(id) DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS acharya_rag.documents (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21), owner text, title text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('reference','paper')), class_level text, subject text,
 catalog_key text, edition text, content_hash text NOT NULL, dedup_key text NOT NULL UNIQUE,
 profile text NOT NULL REFERENCES acharya_rag.embedding_profiles(id), status text NOT NULL CHECK(status IN ('pending','processing','ready','failed')),
 error text, page_count integer NOT NULL, chunk_count integer NOT NULL,
 lease_token varchar(21), lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(owner IS NOT NULL OR kind='reference')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rag_document_owner ON acharya_rag.documents(owner,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS acharya_rag.pages (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21), document_id varchar(21) NOT NULL REFERENCES acharya_rag.documents(id) ON DELETE CASCADE,
 number integer NOT NULL CHECK(number>0), text text NOT NULL, chapter_id varchar(21), chapter_title text,
 method text NOT NULL, UNIQUE(document_id,number)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS acharya_rag.chunks (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21), document_id varchar(21) NOT NULL REFERENCES acharya_rag.documents(id) ON DELETE CASCADE,
 page integer NOT NULL, position integer NOT NULL, text text NOT NULL, chapter_id varchar(21), chapter_title text,
 embedding vector(1536), UNIQUE(document_id,position), FOREIGN KEY(document_id,page) REFERENCES acharya_rag.pages(document_id,number) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rag_chunk_document ON acharya_rag.chunks(document_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rag_chunk_vector ON acharya_rag.chunks USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS acharya_rag.verifications (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21), owner text NOT NULL,
 paper_id varchar(21) NOT NULL REFERENCES acharya_rag.documents(id) ON DELETE CASCADE,
 selections jsonb NOT NULL, dedup_key text NOT NULL UNIQUE,
 status text NOT NULL, error text, extracted_questions jsonb, results jsonb NOT NULL DEFAULT '[]',
 lease_token varchar(21), lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rag_verification_owner ON acharya_rag.verifications(owner,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS acharya_rag.conversations (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21), owner text NOT NULL, title text NOT NULL DEFAULT 'New chat',
 selections jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rag_conversation_owner ON acharya_rag.conversations(owner,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS acharya_rag.messages (
 id varchar(21) PRIMARY KEY CHECK(length(id)=21), conversation_id varchar(21) NOT NULL REFERENCES acharya_rag.conversations(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('user','assistant')), content text NOT NULL, citations jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rag_message_conversation ON acharya_rag.messages(conversation_id,created_at);
--> statement-breakpoint
