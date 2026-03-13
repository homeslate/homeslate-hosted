CREATE TABLE "display_pairing" (
	"code" varchar(12) PRIMARY KEY NOT NULL,
	"display_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "displays" DROP CONSTRAINT "displays_display_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_google_id_unique";--> statement-breakpoint
ALTER TABLE "display_collaborators" DROP CONSTRAINT "display_collaborators_display_id_displays_id_fk";
--> statement-breakpoint
ALTER TABLE "display_collaborators" DROP CONSTRAINT "display_collaborators_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "display_configs" DROP CONSTRAINT "display_configs_display_id_displays_id_fk";
--> statement-breakpoint
ALTER TABLE "display_invites" DROP CONSTRAINT "display_invites_display_id_displays_id_fk";
--> statement-breakpoint
ALTER TABLE "display_invites" DROP CONSTRAINT "display_invites_invited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "displays" DROP CONSTRAINT "displays_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "display_collaborators_display_id_user_id";--> statement-breakpoint
DROP INDEX "display_invites_display_id_invited_email";--> statement-breakpoint
ALTER TABLE "display_configs" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "display_configs" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "display_configs" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "displays" ALTER COLUMN "name" SET DEFAULT 'Kitchen Display';--> statement-breakpoint
ALTER TABLE "displays" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "displays" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "google_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "picture" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "picture" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "display_collaborators" ADD CONSTRAINT "display_collaborators_display_id_fkey" FOREIGN KEY ("display_id") REFERENCES "public"."displays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_collaborators" ADD CONSTRAINT "display_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_configs" ADD CONSTRAINT "display_configs_new_display_id_fkey" FOREIGN KEY ("display_id") REFERENCES "public"."displays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_invites" ADD CONSTRAINT "display_invites_display_id_fkey" FOREIGN KEY ("display_id") REFERENCES "public"."displays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_invites" ADD CONSTRAINT "display_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "displays" ADD CONSTRAINT "displays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_collaborators" ADD CONSTRAINT "display_collaborators_display_id_user_id_key" UNIQUE("display_id","user_id");--> statement-breakpoint
ALTER TABLE "display_invites" ADD CONSTRAINT "display_invites_display_id_invited_email_key" UNIQUE("display_id","invited_email");--> statement-breakpoint
ALTER TABLE "displays" ADD CONSTRAINT "displays_display_id_key" UNIQUE("display_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_key" UNIQUE("google_id");