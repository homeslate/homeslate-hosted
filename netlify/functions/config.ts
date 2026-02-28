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

  if (event.httpMethod === 'GET') {
    try {
      const googleId = await getGoogleId(event.headers['authorization']);
      const rows = await sql`
        SELECT dc.config, dc.updated_at
        FROM display_configs dc
        JOIN users u ON u.id = dc.user_id
        WHERE u.google_id = ${googleId}
      `;
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify(rows[0] ?? { config: null }),
      };
    } catch {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  if (event.httpMethod === 'PUT') {
    try {
      const googleId = await getGoogleId(event.headers['authorization']);
      const config = JSON.parse(event.body ?? '{}');
      await sql`
        INSERT INTO display_configs (user_id, config)
        SELECT id, ${JSON.stringify(config)}::jsonb FROM users WHERE google_id = ${googleId}
        ON CONFLICT (user_id) DO UPDATE SET
          config = EXCLUDED.config,
          updated_at = NOW()
      `;
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('Config save error:', err);
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Failed to save' }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
