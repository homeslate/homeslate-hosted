CREATE TABLE "display_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "display_configs" (
	"display_id" uuid PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "display_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_id" uuid NOT NULL,
	"invited_email" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "displays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"passcode_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "displays_display_id_unique" UNIQUE("display_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"picture" text NOT NULL,
	"refresh_token" text,
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "display_collaborators" ADD CONSTRAINT "display_collaborators_display_id_displays_id_fk" FOREIGN KEY ("display_id") REFERENCES "public"."displays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_collaborators" ADD CONSTRAINT "display_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_configs" ADD CONSTRAINT "display_configs_display_id_displays_id_fk" FOREIGN KEY ("display_id") REFERENCES "public"."displays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_invites" ADD CONSTRAINT "display_invites_display_id_displays_id_fk" FOREIGN KEY ("display_id") REFERENCES "public"."displays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_invites" ADD CONSTRAINT "display_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "displays" ADD CONSTRAINT "displays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "display_collaborators_display_id_user_id" ON "display_collaborators" USING btree ("display_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "display_invites_display_id_invited_email" ON "display_invites" USING btree ("display_id","invited_email");