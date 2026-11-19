ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "available_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "events" SET "status" = 'pending' WHERE "status" = 'failed';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_available_idx" ON "events" USING btree ("status", "available_at", "created_at");
