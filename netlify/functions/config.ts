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

  if (event.httpMethod === 'PUT') {
    try {
      const googleId = await getGoogleId(event.headers['authorization']);
      const displayId = event.queryStringParameters?.displayId;
      if (!displayId) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing displayId' }) };
      }
      const config = JSON.parse(event.body ?? '{}');
      const sql = neon(process.env.DATABASE_URL!);

      // Verify the display belongs to the authenticated user OR they are a collaborator
      const check = await sql`
        SELECT d.id FROM displays d
        JOIN users u ON u.id = d.user_id
        WHERE d.id = ${displayId}::uuid AND u.google_id = ${googleId}
        UNION ALL
        SELECT d.id FROM display_collaborators dc
        JOIN users u ON u.id = dc.user_id
        JOIN displays d ON d.id = dc.display_id
        WHERE d.id = ${displayId}::uuid AND u.google_id = ${googleId}
        LIMIT 1
      `;
      if (check.length === 0) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
      }

      await sql`
        INSERT INTO display_configs (display_id, config)
        VALUES (${displayId}::uuid, ${JSON.stringify(config)}::jsonb)
        ON CONFLICT (display_id) DO UPDATE SET
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
