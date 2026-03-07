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

    // Verify requester owns or collaborates on the display
    const access = await sql`
      SELECT 1 FROM displays d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = ${displayId}::uuid AND u.google_id = ${googleId}
      UNION ALL
      SELECT 1 FROM display_collaborators dc
      JOIN users u ON u.id = dc.user_id
      WHERE dc.display_id = ${displayId}::uuid AND u.google_id = ${googleId}
      LIMIT 1
    `;
    if (access.length === 0) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const [invites, collaborators] = await Promise.all([
      sql`
        SELECT di.id, di.invited_email, di.created_at
        FROM display_invites di
        WHERE di.display_id = ${displayId}::uuid
        ORDER BY di.created_at ASC
      `,
      sql`
        SELECT dc.id, u.email, u.name, u.picture, dc.created_at
        FROM display_collaborators dc
        JOIN users u ON u.id = dc.user_id
        WHERE dc.display_id = ${displayId}::uuid
        ORDER BY dc.created_at ASC
      `,
    ]);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ invites, collaborators }),
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

    // Verify requester owns the display
    const ownerCheck = await sql`
      SELECT d.id FROM displays d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = ${displayId}::uuid AND u.google_id = ${googleId}
    `;
    if (ownerCheck.length === 0) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Only the owner can invite people' }) };
    }

    // Don't invite yourself
    const selfCheck = await sql`
      SELECT 1 FROM users WHERE google_id = ${googleId} AND LOWER(email) = ${normalizedEmail} LIMIT 1
    `;
    if (selfCheck.length > 0) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'You cannot invite yourself' }) };
    }

    // Don't re-invite an existing collaborator
    const collabCheck = await sql`
      SELECT 1 FROM display_collaborators dc
      JOIN users u ON u.id = dc.user_id
      WHERE dc.display_id = ${displayId}::uuid AND LOWER(u.email) = ${normalizedEmail}
      LIMIT 1
    `;
    if (collabCheck.length > 0) {
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'This person is already a collaborator' }) };
    }

    // Get inviter's user id
    const inviterRows = await sql`SELECT id FROM users WHERE google_id = ${googleId} LIMIT 1`;
    const inviterId = (inviterRows[0] as { id: string }).id;

    // Upsert invite (idempotent — just update created_at on conflict)
    const rows = await sql`
      INSERT INTO display_invites (display_id, invited_email, invited_by)
      VALUES (${displayId}::uuid, ${normalizedEmail}, ${inviterId}::uuid)
      ON CONFLICT (display_id, invited_email) DO UPDATE SET created_at = NOW()
      RETURNING id, invited_email, created_at
    `;

    return { statusCode: 201, headers: CORS, body: JSON.stringify(rows[0]) };
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

    // Verify requester owns the display
    const ownerCheck = await sql`
      SELECT d.id FROM displays d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = ${displayId}::uuid AND u.google_id = ${googleId}
    `;
    if (ownerCheck.length === 0) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Only the owner can remove access' }) };
    }

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      await sql`
        DELETE FROM display_invites
        WHERE display_id = ${displayId}::uuid AND LOWER(invited_email) = ${normalizedEmail}
      `;
    } else if (collaboratorId) {
      await sql`
        DELETE FROM display_collaborators
        WHERE display_id = ${displayId}::uuid AND id = ${collaboratorId}::uuid
      `;
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
