import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json',
};

async function verifyToken(accessToken: string): Promise<{ sub: string; email: string }> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Invalid token');
  const data = await res.json() as { aud: string; sub: string; email: string };
  if (data.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Token audience mismatch');
  return { sub: data.sub, email: data.email };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const authHeader = event.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const accessToken = authHeader.slice(7);

  try {
    const { sub: googleId, email } = await verifyToken(accessToken);

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { name, picture } = await userInfoRes.json() as { name: string; picture: string };

    const sql = neon(process.env.DATABASE_URL!);

    // Upsert user (no display_id column anymore)
    const rows = await sql`
      INSERT INTO users (google_id, email, name, picture)
      VALUES (${googleId}, ${email}, ${name}, ${picture})
      ON CONFLICT (google_id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        picture = EXCLUDED.picture
      RETURNING id, email, name, picture
    `;

    const user = rows[0] as { id: string; email: string; name: string; picture: string };

    // Ensure user has at least one display
    const displayCheck = await sql`
      SELECT id FROM displays WHERE user_id = ${user.id} LIMIT 1
    `;
    if (displayCheck.length === 0) {
      await sql`
        INSERT INTO displays (user_id, name)
        VALUES (${user.id}, 'Kitchen Display')
      `;
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify(user) };
  } catch (err) {
    console.error('Auth error:', err);
    return {
      statusCode: 401,
      headers: CORS,
      body: JSON.stringify({ error: 'Authentication failed' }),
    };
  }
};
