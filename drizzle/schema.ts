import { pgTable, unique, uuid, varchar, timestamp, foreignKey, text, jsonb } from "drizzle-orm/pg-core"



export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	googleId: varchar("google_id").notNull(),
	email: varchar().notNull(),
	name: varchar(),
	picture: varchar(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: 'string' }),
	plan: varchar('plan').default('free').notNull(),
	stripeCustomerId: text('stripe_customer_id'),
	stripeSubscriptionId: text('stripe_subscription_id'),
	stripePriceId: text('stripe_price_id'),
	subscriptionStatus: varchar('subscription_status'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_google_id_key").on(table.googleId),
]);

export const displays = pgTable("displays", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	displayId: uuid("display_id").defaultRandom().notNull(),
	name: text().default('Homeslate').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	passcodeHash: text("passcode_hash"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "displays_user_id_fkey"
		}).onDelete("cascade"),
	unique("displays_display_id_key").on(table.displayId),
]);

export const displayConfigs = pgTable("display_configs", {
	displayId: uuid("display_id").primaryKey().notNull(),
	config: jsonb().default({}).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.displayId],
			foreignColumns: [displays.id],
			name: "display_configs_new_display_id_fkey"
		}).onDelete("cascade"),
]);

export const displayCollaborators = pgTable("display_collaborators", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	displayId: uuid("display_id").notNull(),
	userId: uuid("user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.displayId],
			foreignColumns: [displays.id],
			name: "display_collaborators_display_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "display_collaborators_user_id_fkey"
		}).onDelete("cascade"),
	unique("display_collaborators_display_id_user_id_key").on(table.displayId, table.userId),
]);

export const displayInvites = pgTable("display_invites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	displayId: uuid("display_id").notNull(),
	invitedEmail: text("invited_email").notNull(),
	invitedBy: uuid("invited_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.displayId],
			foreignColumns: [displays.id],
			name: "display_invites_display_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [users.id],
			name: "display_invites_invited_by_fkey"
		}).onDelete("cascade"),
	unique("display_invites_display_id_invited_email_key").on(table.displayId, table.invitedEmail),
]);

// Short-lived codes for pairing a headless device to a new display (no auth on device).
export const displayPairing = pgTable("display_pairing", {
	code: varchar("code", { length: 12 }).primaryKey().notNull(),
	displayId: uuid("display_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
});
