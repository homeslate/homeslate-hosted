import { relations } from "drizzle-orm/relations";
import { users, displays, displayConfigs, displayCollaborators, displayInvites } from "./schema";

export const displaysRelations = relations(displays, ({one, many}) => ({
	user: one(users, {
		fields: [displays.userId],
		references: [users.id]
	}),
	displayConfigs: many(displayConfigs),
	displayCollaborators: many(displayCollaborators),
	displayInvites: many(displayInvites),
}));

export const usersRelations = relations(users, ({many}) => ({
	displays: many(displays),
	displayCollaborators: many(displayCollaborators),
	displayInvites: many(displayInvites),
}));

export const displayConfigsRelations = relations(displayConfigs, ({one}) => ({
	display: one(displays, {
		fields: [displayConfigs.displayId],
		references: [displays.id]
	}),
}));

export const displayCollaboratorsRelations = relations(displayCollaborators, ({one}) => ({
	display: one(displays, {
		fields: [displayCollaborators.displayId],
		references: [displays.id]
	}),
	user: one(users, {
		fields: [displayCollaborators.userId],
		references: [users.id]
	}),
}));

export const displayInvitesRelations = relations(displayInvites, ({one}) => ({
	display: one(displays, {
		fields: [displayInvites.displayId],
		references: [displays.id]
	}),
	user: one(users, {
		fields: [displayInvites.invitedBy],
		references: [users.id]
	}),
}));