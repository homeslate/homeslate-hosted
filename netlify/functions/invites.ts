import type { Handler } from '@netlify/functions';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  getDb,
  users,
  displays,
  displayCollaborators,
  displayInvites,
} from '../../apps/hosted/src/db';
import type { InviteCreateRequest } from '../../apps/hosted/src/types/api';
import { AUTH_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from './_shared/http';
import { requireGoogleId } from './_shared/googleAuth';

const InviteBodySchema: z.ZodType<InviteCreateRequest> = z.object({
  displayId: z.string().uuid(),
  email: z.string().trim().email(),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(AUTH_JSON_HEADERS);
  }

  const db = getDb();

  let googleId: string;
  try {
    googleId = await requireGoogleId(event.headers['authorization']);
  } catch {
    return errorResponse(401, 'Unauthorized', AUTH_JSON_HEADERS);
  }

  // GET /api/invites?displayId=<id> — list pending invites and collaborators for a display
  if (event.httpMethod === 'GET') {
    const displayId = event.queryStringParameters?.displayId;
    if (!displayId) {
      return errorResponse(400, 'Missing displayId', AUTH_JSON_HEADERS);
    }

    const ownerAccess = await db
      .select({ one: sql`1` })
      .from(displays)
      .innerJoin(users, eq(users.id, displays.userId))
      .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

    const collabAccess = await db
      .select({ one: sql`1` })
      .from(displayCollaborators)
      .innerJoin(users, eq(users.id, displayCollaborators.userId))
      .where(sql`${displayCollaborators.displayId} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

    if (ownerAccess.length === 0 && collabAccess.length === 0) {
      return errorResponse(403, 'Forbidden', AUTH_JSON_HEADERS);
    }

    const [invites, collaborators] = await Promise.all([
      db
        .select({
          id: displayInvites.id,
          invitedEmail: displayInvites.invitedEmail,
          createdAt: displayInvites.createdAt,
        })
        .from(displayInvites)
        .where(eq(displayInvites.displayId, displayId))
        .orderBy(asc(displayInvites.createdAt)),
      db
        .select({
          id: displayCollaborators.id,
          email: users.email,
          name: users.name,
          picture: users.picture,
          createdAt: displayCollaborators.createdAt,
        })
        .from(displayCollaborators)
        .innerJoin(users, eq(users.id, displayCollaborators.userId))
        .where(eq(displayCollaborators.displayId, displayId))
        .orderBy(asc(displayCollaborators.createdAt)),
    ]);

    return {
      statusCode: 200,
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        invites: invites.map((i) => ({ id: i.id, invited_email: i.invitedEmail, created_at: i.createdAt })),
        collaborators: collaborators.map((c) => ({
          id: c.id,
          email: c.email,
          name: c.name,
          picture: c.picture,
          created_at: c.createdAt,
        })),
      }),
    };
  }

  // POST /api/invites — send an invite (owner only)
  if (event.httpMethod === 'POST') {
    let body: unknown;
    try {
      body = JSON.parse(event.body ?? '{}');
    } catch {
      return errorResponse(400, 'Invalid JSON body', AUTH_JSON_HEADERS);
    }
    const parsed = InviteBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, 'Invalid invite payload', AUTH_JSON_HEADERS, {
        details: parsed.error.flatten(),
      });
    }

    const { displayId, email } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const ownerCheck = await db
      .select({ id: displays.id })
      .from(displays)
      .innerJoin(users, eq(users.id, displays.userId))
      .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

    if (ownerCheck.length === 0) {
      return errorResponse(403, 'Only the owner can invite people', AUTH_JSON_HEADERS);
    }

    const selfCheck = await db
      .select({ one: sql`1` })
      .from(users)
      .where(sql`${users.googleId} = ${googleId} AND LOWER(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (selfCheck.length > 0) {
      return errorResponse(400, 'You cannot invite yourself', AUTH_JSON_HEADERS);
    }

    const collabCheck = await db
      .select({ one: sql`1` })
      .from(displayCollaborators)
      .innerJoin(users, eq(users.id, displayCollaborators.userId))
      .where(
        sql`${displayCollaborators.displayId} = ${displayId}::uuid AND LOWER(${users.email}) = ${normalizedEmail}`
      )
      .limit(1);

    if (collabCheck.length > 0) {
      return errorResponse(409, 'This person is already a collaborator', AUTH_JSON_HEADERS);
    }

    const [inviter] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);

    if (!inviter) {
      return errorResponse(500, 'User not found', AUTH_JSON_HEADERS);
    }

    const [created] = await db
      .insert(displayInvites)
      .values({
        displayId,
        invitedEmail: normalizedEmail,
        invitedBy: inviter.id,
      })
      .onConflictDoUpdate({
        target: [displayInvites.displayId, displayInvites.invitedEmail],
        set: { createdAt: new Date() },
      })
      .returning({ id: displayInvites.id, invitedEmail: displayInvites.invitedEmail, createdAt: displayInvites.createdAt });

    if (!created) {
      return errorResponse(500, 'Failed to create invite', AUTH_JSON_HEADERS);
    }

    return {
      statusCode: 201,
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        id: created.id,
        invited_email: created.invitedEmail,
        created_at: created.createdAt,
      }),
    };
  }

  // DELETE /api/invites?displayId=<id>&email=<email>   — revoke a pending invite (owner only)
  // DELETE /api/invites?displayId=<id>&collaboratorId=<id>  — remove a collaborator (owner only)
  if (event.httpMethod === 'DELETE') {
    const displayId = event.queryStringParameters?.displayId;
    const email = event.queryStringParameters?.email;
    const collaboratorId = event.queryStringParameters?.collaboratorId;

    if (!displayId || (!email && !collaboratorId)) {
      return errorResponse(400, 'Missing displayId and email or collaboratorId', AUTH_JSON_HEADERS);
    }

    const ownerCheck = await db
      .select({ id: displays.id })
      .from(displays)
      .innerJoin(users, eq(users.id, displays.userId))
      .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

    if (ownerCheck.length === 0) {
      return errorResponse(403, 'Only the owner can remove access', AUTH_JSON_HEADERS);
    }

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      await db
        .delete(displayInvites)
        .where(
          and(
            eq(displayInvites.displayId, displayId),
            sql`LOWER(${displayInvites.invitedEmail}) = ${normalizedEmail}`
          )
        );
    } else if (collaboratorId) {
      await db
        .delete(displayCollaborators)
        .where(
          and(
            eq(displayCollaborators.displayId, displayId),
            eq(displayCollaborators.id, collaboratorId)
          )
        );
    }

    return jsonResponse(200, { ok: true }, AUTH_JSON_HEADERS);
  }

  return errorResponse(405, 'Method not allowed', AUTH_JSON_HEADERS);
};
