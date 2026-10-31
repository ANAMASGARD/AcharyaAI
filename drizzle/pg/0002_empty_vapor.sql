CREATE TABLE "recording_chunks" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"session_id" varchar(21) NOT NULL,
	"chunk_index" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"claim_token" text,
	"lease_until" timestamp with time zone,
	"audio_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"transcript" text DEFAULT '' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recording_chunks_bounds" CHECK ("recording_chunks"."chunk_index" >= 0 AND "recording_chunks"."start_ms" >= 0 AND "recording_chunks"."duration_ms" > 0 AND "recording_chunks"."duration_ms" <= 30000)
);
--> statement-breakpoint
CREATE TABLE "recording_rate_limits" (
	"owner_clerk_id" text PRIMARY KEY NOT NULL,
	"last_request_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recording_sessions" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"owner_clerk_id" text NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"grade" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'recording' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"expected_chunk_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "recording_sessions_nonnegative" CHECK ("recording_sessions"."duration_ms" >= 0 AND "recording_sessions"."expected_chunk_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "recording_chunks" ADD CONSTRAINT "recording_chunks_session_id_recording_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."recording_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recording_chunks_session_sequence_idx" ON "recording_chunks" USING btree ("session_id","chunk_index");--> statement-breakpoint
CREATE INDEX "recording_sessions_owner_idx" ON "recording_sessions" USING btree ("owner_clerk_id");