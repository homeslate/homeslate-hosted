ALTER TABLE "displays" ALTER COLUMN "name" SET DEFAULT 'Homeslate';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" varchar DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" varchar;