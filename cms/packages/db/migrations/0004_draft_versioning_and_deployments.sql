ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "draft_content" jsonb;
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "has_unpublished_changes" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "published_version" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"target" text DEFAULT 'local' NOT NULL,
	"domain" text,
	"live_url" text,
	"output_path" text,
	"logs" text DEFAULT '' NOT NULL,
	"error_message" text,
	"rollback_from_id" uuid,
	"triggered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployments_site_created_idx" ON "deployments" USING btree ("site_id","created_at");
