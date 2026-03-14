ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_token" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_token_expires_at" timestamp with time zone;
