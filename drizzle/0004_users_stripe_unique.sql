CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_id_key" ON "users" ("stripe_customer_id") WHERE "stripe_customer_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_subscription_id_key" ON "users" ("stripe_subscription_id") WHERE "stripe_subscription_id" IS NOT NULL;
