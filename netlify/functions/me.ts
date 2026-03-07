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

    // Redeem any pending invites for this email (idempotent)
    try {
      const pendingInvites = await sql`
        SELECT display_id FROM display_invites
        WHERE LOWER(invited_email) = LOWER(${email})
      `;
      for (const invite of pendingInvites as { display_id: string }[]) {
        await sql`
          INSERT INTO display_collaborators (display_id, user_id)
          VALUES (${invite.display_id}::uuid, ${user.id}::uuid)
          ON CONFLICT (display_id, user_id) DO NOTHING
        `;
        await sql`
          DELETE FROM display_invites
          WHERE display_id = ${invite.display_id}::uuid
            AND LOWER(invited_email) = LOWER(${email})
        `;
      }
    } catch {
      // If invite tables don't exist yet, skip gracefully
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
