import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';

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

  const sql = neon(process.env.DATABASE_URL!);
  let googleId: string;
  try {
    googleId = await getGoogleId(event.headers['authorization']);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // Ensure passcode_hash column exists (idempotent migration)
  try {
    await sql`ALTER TABLE displays ADD COLUMN IF NOT EXISTS passcode_hash TEXT`;
  } catch {
    // column already exists or DDL not supported — ignore
  }

  // Ensure collaborator/invite tables exist (idempotent)
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS display_collaborators (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_id  UUID NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (display_id, user_id)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS display_invites (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_id  UUID NOT NULL REFERENCES displays(id) ON DELETE CASCADE,
        invited_email TEXT NOT NULL,
        invited_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (display_id, invited_email)
      )
    `;
  } catch {
    // tables already exist — ignore
  }

  // GET /api/displays — list user's owned displays + displays shared with them
  if (event.httpMethod === 'GET') {
    try {
      const rows = await sql`
        SELECT
          d.id,
          d.display_id,
          d.name,
          d.created_at,
          (d.passcode_hash IS NOT NULL) AS passcode_enabled,
          dc.config,
          dc.updated_at AS config_updated_at,
          (d.user_id = owner_u.id) AS is_owner
        FROM displays d
        JOIN users owner_u ON owner_u.id = d.user_id
        LEFT JOIN display_configs dc ON dc.display_id = d.id
        WHERE owner_u.google_id = ${googleId}

        UNION ALL

        SELECT
          d.id,
          d.display_id,
          d.name,
          d.created_at,
          (d.passcode_hash IS NOT NULL) AS passcode_enabled,
          dc.config,
          dc.updated_at AS config_updated_at,
          false AS is_owner
        FROM display_collaborators col
        JOIN users u ON u.id = col.user_id
        JOIN displays d ON d.id = col.display_id
        LEFT JOIN display_configs dc ON dc.display_id = d.id
        WHERE u.google_id = ${googleId}

        ORDER BY created_at ASC
      `;
      return { statusCode: 200, headers: CORS, body: JSON.stringify(rows) };
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
      const rows = await sql`
        INSERT INTO displays (user_id, name)
        SELECT id, ${displayName} FROM users WHERE google_id = ${googleId}
        RETURNING id, display_id, name, created_at
      `;
      return { statusCode: 201, headers: CORS, body: JSON.stringify(rows[0]) };
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

      // Validate: must have at least one field to update
      if (!body.name?.trim() && !('passcode' in body)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Nothing to update' }) };
      }

      // Validate passcode format if provided (4 digits or null to clear)
      if ('passcode' in body && body.passcode !== null) {
        if (!/^\d{4}$/.test(body.passcode ?? '')) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Passcode must be 4 digits' }) };
        }
      }

      // Build update: name only, passcode only, or both
      // Allow owner OR collaborator to perform the update
      const accessFilter = sql`(
        d.user_id = (SELECT id FROM users WHERE google_id = ${googleId})
        OR EXISTS (
          SELECT 1 FROM display_collaborators dc2
          JOIN users u2 ON u2.id = dc2.user_id
          WHERE dc2.display_id = d.id AND u2.google_id = ${googleId}
        )
      )`;
      let rows;
      if (body.name?.trim() && 'passcode' in body) {
        const newHash = body.passcode !== null ? hashPin(body.passcode!) : null;
        rows = await sql`
          UPDATE displays d
          SET name = ${body.name.trim()}, passcode_hash = ${newHash}
          WHERE d.id = ${id}::uuid AND ${accessFilter}
          RETURNING d.id, d.display_id, d.name, d.created_at, (d.passcode_hash IS NOT NULL) AS passcode_enabled
        `;
      } else if (body.name?.trim()) {
        rows = await sql`
          UPDATE displays d
          SET name = ${body.name.trim()}
          WHERE d.id = ${id}::uuid AND ${accessFilter}
          RETURNING d.id, d.display_id, d.name, d.created_at, (d.passcode_hash IS NOT NULL) AS passcode_enabled
        `;
      } else {
        const newHash = body.passcode !== null ? hashPin(body.passcode!) : null;
        rows = await sql`
          UPDATE displays d
          SET passcode_hash = ${newHash}
          WHERE d.id = ${id}::uuid AND ${accessFilter}
          RETURNING d.id, d.display_id, d.name, d.created_at, (d.passcode_hash IS NOT NULL) AS passcode_enabled
        `;
      }

      if (rows.length === 0) {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify(rows[0]) };
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

      // Don't delete if it's the user's last OWNED display
      const countRows = await sql`
        SELECT COUNT(*) AS cnt FROM displays d
        JOIN users u ON u.id = d.user_id
        WHERE u.google_id = ${googleId}
      `;
      if (Number((countRows[0] as { cnt: string }).cnt) <= 1) {
        return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'Cannot delete last display' }) };
      }

      // Only owner can delete
      await sql`
        DELETE FROM displays d
        USING users u
        WHERE d.id = ${id}::uuid
          AND d.user_id = u.id
          AND u.google_id = ${googleId}
      `;
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('Display delete error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to delete' }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
