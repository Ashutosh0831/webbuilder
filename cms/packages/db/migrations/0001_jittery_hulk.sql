CREATE TABLE IF NOT EXISTS "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"section_key" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"raw_content" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parsed_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"seo_canonical" text,
	"seo_og_image" text,
	"seo_robots" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "seo_canonical" text;
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "seo_og_image" text;
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "seo_robots" text;
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pages_site_section_slug_idx" ON "pages" ("site_id","section_key","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pages_site_status_idx" ON "pages" ("site_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pages_site_created_idx" ON "pages" ("site_id","created_at");
