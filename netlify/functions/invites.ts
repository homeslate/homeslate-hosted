import type { Handler } from '@netlify/functions';
import { and, asc, eq, sql } from 'drizzle-orm';
import {
  getDb,
  users,
  displays,
  displayCollaborators,
  displayInvites,
} from '../../src/db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json',
};

async function getGoogleId(authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('No token');
  const token = authHeader.slice(7);
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
  if (!res.ok) throw new Error('Invalid token');
  const data = await res.json() as { aud: string; sub: string };
  if (data.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Token mismatch');
  return data.sub;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const db = getDb();

  let googleId: string;
  try {
    googleId = await getGoogleId(event.headers['authorization']);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS display_collaborators (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_id  UUID NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (display_id, user_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS display_invites (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_id  UUID NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
        invited_email TEXT NOT NULL,
        invited_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (display_id, invited_email)
      )
    `);
  } catch (err) {
    console.error('Migration error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'DB setup failed' }) };
  }

  // GET /api/invites?displayId=<id> — list pending invites and collaborators for a display
  if (event.httpMethod === 'GET') {
    const displayId = event.queryStringParameters?.displayId;
    if (!displayId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing displayId' }) };
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
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
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
      headers: CORS,
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
    const { displayId, email } = JSON.parse(event.body ?? '{}') as {
      displayId?: string;
      email?: string;
    };

    if (!displayId || !email?.trim()) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing displayId or email' }) };
    }

    const normalizedEmail = email.trim().toLowerCase();

    const ownerCheck = await db
      .select({ id: displays.id })
      .from(displays)
      .innerJoin(users, eq(users.id, displays.userId))
      .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

    if (ownerCheck.length === 0) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Only the owner can invite people' }) };
    }

    const selfCheck = await db
      .select({ one: sql`1` })
      .from(users)
      .where(sql`${users.googleId} = ${googleId} AND LOWER(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (selfCheck.length > 0) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'You cannot invite yourself' }) };
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
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'This person is already a collaborator' }) };
    }

    const [inviter] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);

    if (!inviter) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'User not found' }) };
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
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to create invite' }) };
    }

    return {
      statusCode: 201,
      headers: CORS,
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
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'Missing displayId and email or collaboratorId' }),
      };
    }

    const ownerCheck = await db
      .select({ id: displays.id })
      .from(displays)
      .innerJoin(users, eq(users.id, displays.userId))
      .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

    if (ownerCheck.length === 0) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Only the owner can remove access' }) };
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

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
