import { pgTable, unique, uuid, varchar, timestamp, foreignKey, text, jsonb } from "drizzle-orm/pg-core"



export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	googleId: varchar("google_id").notNull(),
	email: varchar().notNull(),
	name: varchar(),
	picture: varchar(),
	refreshToken: text("refresh_token"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_google_id_key").on(table.googleId),
]);

export const displays = pgTable("displays", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	displayId: uuid("display_id").defaultRandom().notNull(),
	name: text().default('Kitchen Display').notNull(),
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
