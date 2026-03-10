import type { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import {
  getDb,
  users,
  displays,
  displayConfigs,
  displayCollaborators,
} from '../../src/db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json',
};

function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

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

  // Ensure passcode_hash column exists (idempotent migration)
  try {
    await db.execute(sql`ALTER TABLE displays ADD COLUMN IF NOT EXISTS passcode_hash TEXT`);
  } catch {
    // column already exists or DDL not supported — ignore
  }

  // Ensure collaborator/invite tables exist (idempotent)
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
  } catch {
    // tables already exist — ignore
  }

  // GET /api/displays — list user's owned displays + displays shared with them
  if (event.httpMethod === 'GET') {
    try {
      const ownerRows = await db
        .select({
          id: displays.id,
          displayId: displays.displayId,
          name: displays.name,
          createdAt: displays.createdAt,
          passcodeEnabled: sql<boolean>`(${displays.passcodeHash} IS NOT NULL)`.as('passcode_enabled'),
          config: displayConfigs.config,
          configUpdatedAt: displayConfigs.updatedAt,
          isOwner: sql<boolean>`true`.as('is_owner'),
        })
        .from(displays)
        .innerJoin(users, eq(users.id, displays.userId))
        .leftJoin(displayConfigs, eq(displayConfigs.displayId, displays.id))
        .where(eq(users.googleId, googleId));

      const collabRows = await db
        .select({
          id: displays.id,
          displayId: displays.displayId,
          name: displays.name,
          createdAt: displays.createdAt,
          passcodeEnabled: sql<boolean>`(${displays.passcodeHash} IS NOT NULL)`.as('passcode_enabled'),
          config: displayConfigs.config,
          configUpdatedAt: displayConfigs.updatedAt,
          isOwner: sql<boolean>`false`.as('is_owner'),
        })
        .from(displayCollaborators)
        .innerJoin(users, eq(users.id, displayCollaborators.userId))
        .innerJoin(displays, eq(displays.id, displayCollaborators.displayId))
        .leftJoin(displayConfigs, eq(displayConfigs.displayId, displays.id))
        .where(eq(users.googleId, googleId));

      const rows = [...ownerRows, ...collabRows].sort(
        (a, b) =>
          (a.createdAt instanceof Date ? a.createdAt.getTime() : 0) -
          (b.createdAt instanceof Date ? b.createdAt.getTime() : 0)
      );

      const formatted = rows.map((r) => ({
        id: r.id,
        display_id: r.displayId,
        name: r.name,
        created_at: r.createdAt,
        passcode_enabled: r.passcodeEnabled,
        config: r.config,
        config_updated_at: r.configUpdatedAt,
        is_owner: r.isOwner,
      }));

      return { statusCode: 200, headers: CORS, body: JSON.stringify(formatted) };
    } catch (err) {
      console.error('Displays fetch error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server error' }) };
    }
  }

  // POST /api/displays — create a new display
  if (event.httpMethod === 'POST') {
    try {
      const { name } = JSON.parse(event.body ?? '{}') as { name?: string };
      const displayName = name?.trim() || 'Kitchen Display';

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.googleId, googleId));

      if (!user) {
        return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'User not found' }) };
      }

      const [created] = await db
        .insert(displays)
        .values({ userId: user.id, name: displayName })
        .returning({ id: displays.id, displayId: displays.displayId, name: displays.name, createdAt: displays.createdAt });

      if (!created) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to create' }) };
      }

      return {
        statusCode: 201,
        headers: CORS,
        body: JSON.stringify({
          id: created.id,
          display_id: created.displayId,
          name: created.name,
          created_at: created.createdAt,
        }),
      };
    } catch (err) {
      console.error('Display create error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to create' }) };
    }
  }

  // PATCH /api/displays?id=<id> — rename a display or update its passcode
  if (event.httpMethod === 'PATCH') {
    try {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing id' }) };
      const body = JSON.parse(event.body ?? '{}') as { name?: string; passcode?: string | null };

      if (!body.name?.trim() && !('passcode' in body)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Nothing to update' }) };
      }

      if ('passcode' in body && body.passcode !== null) {
        if (!/^\d{4}$/.test(body.passcode ?? '')) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Passcode must be 4 digits' }) };
        }
      }

      const accessFilter = sql`(
        ${displays.userId} = (SELECT id FROM users WHERE google_id = ${googleId})
        OR EXISTS (
          SELECT 1 FROM display_collaborators dc2
          JOIN users u2 ON u2.id = dc2.user_id
          WHERE dc2.display_id = ${displays.id} AND u2.google_id = ${googleId}
        )
      )`;

      const updateSet: { name?: string; passcodeHash?: string | null } = {};
      if (body.name?.trim()) updateSet.name = body.name.trim();
      if ('passcode' in body) updateSet.passcodeHash = body.passcode !== null ? hashPin(body.passcode!) : null;

      const rows = await db
        .update(displays)
        .set(updateSet)
        .where(sql`${displays.id} = ${id}::uuid AND ${accessFilter}`)
        .returning({
          id: displays.id,
          displayId: displays.displayId,
          name: displays.name,
          createdAt: displays.createdAt,
          passcodeEnabled: sql<boolean>`(${displays.passcodeHash} IS NOT NULL)`.as('passcode_enabled'),
        });

      if (rows.length === 0) {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
      }

      const r = rows[0];
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          id: r.id,
          display_id: r.displayId,
          name: r.name,
          created_at: r.createdAt,
          passcode_enabled: r.passcodeEnabled,
        }),
      };
    } catch (err) {
      console.error('Display patch error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to update' }) };
    }
  }

  // DELETE /api/displays?id=<id> — delete a display
  if (event.httpMethod === 'DELETE') {
    try {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing id' }) };

      const countRows = await db
        .select({ cnt: sql<number>`count(*)` })
        .from(displays)
        .innerJoin(users, eq(users.id, displays.userId))
        .where(eq(users.googleId, googleId));

      const cnt = Number(countRows[0]?.cnt ?? 0);
      if (cnt <= 1) {
        return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'Cannot delete last display' }) };
      }

      await db
        .delete(displays)
        .where(
          sql`${displays.id} = ${id}::uuid AND ${displays.userId} IN (SELECT id FROM users WHERE google_id = ${googleId})`
        );

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('Display delete error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to delete' }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
