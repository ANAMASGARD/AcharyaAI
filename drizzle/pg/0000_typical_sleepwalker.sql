CREATE TABLE "applied_operations" (
	"operation_id" varchar(21) PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_change_log" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"entity" text NOT NULL,
	"record_id" varchar(21) NOT NULL,
	"revision" bigint NOT NULL,
	"op" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teaching_sessions" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"owner_clerk_id" text NOT NULL,
	"title" text NOT NULL,
	"grade" text,
	"subject" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"local_audio_uri" text,
	"upload_status" text DEFAULT 'local' NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE INDEX "sync_change_log_clerk_seq_idx" ON "sync_change_log" USING btree ("clerk_user_id","seq");