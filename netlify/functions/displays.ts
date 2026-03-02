import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

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

  const sql = neon(process.env.DATABASE_URL!);
  let googleId: string;
  try {
    googleId = await getGoogleId(event.headers['authorization']);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // GET /api/displays — list user's displays with embedded configs
  if (event.httpMethod === 'GET') {
    try {
      const rows = await sql`
        SELECT
          d.id,
          d.display_id,
          d.name,
          d.created_at,
          dc.config,
          dc.updated_at AS config_updated_at
        FROM displays d
        JOIN users u ON u.id = d.user_id
        LEFT JOIN display_configs dc ON dc.display_id = d.id
        WHERE u.google_id = ${googleId}
        ORDER BY d.created_at ASC
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

  // PATCH /api/displays?id=<id> — rename a display
  if (event.httpMethod === 'PATCH') {
    try {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing id' }) };
      const { name } = JSON.parse(event.body ?? '{}') as { name?: string };
      if (!name?.trim()) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing name' }) };

      const rows = await sql`
        UPDATE displays d
        SET name = ${name.trim()}
        FROM users u
        WHERE d.id = ${id}::uuid
          AND d.user_id = u.id
          AND u.google_id = ${googleId}
        RETURNING d.id, d.display_id, d.name, d.created_at
      `;
      if (rows.length === 0) {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify(rows[0]) };
    } catch (err) {
      console.error('Display rename error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to rename' }) };
    }
  }

  // DELETE /api/displays?id=<id> — delete a display
  if (event.httpMethod === 'DELETE') {
    try {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing id' }) };

      // Don't delete if it's the user's last display
      const countRows = await sql`
        SELECT COUNT(*) AS cnt FROM displays d
        JOIN users u ON u.id = d.user_id
        WHERE u.google_id = ${googleId}
      `;
      if (Number((countRows[0] as { cnt: string }).cnt) <= 1) {
        return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'Cannot delete last display' }) };
      }

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
