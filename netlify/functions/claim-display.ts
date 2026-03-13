import type { Handler } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import {
  getDb,
  users,
  displays,
  displayPairing,
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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const db = getDb();
  let googleId: string;
  try {
    googleId = await getGoogleId(event.headers['authorization']);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const body = JSON.parse(event.body ?? '{}') as { code?: string };
  const code = body.code?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code || code.length !== 6) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid or missing code' }) };
  }

  try {
    const [pairRow] = await db
      .select()
      .from(displayPairing)
      .where(eq(displayPairing.code, code));

    if (!pairRow) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Code not found' }) };
    }
    if (pairRow.displayId) {
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'Code already claimed' }) };
    }

    const expiresAt = typeof pairRow.expiresAt === 'string' ? new Date(pairRow.expiresAt) : pairRow.expiresAt;
    if (expiresAt.getTime() < Date.now()) {
      return { statusCode: 410, headers: CORS, body: JSON.stringify({ error: 'Code expired' }) };
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.googleId, googleId));

    if (!user) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'User not found' }) };
    }

    const [created] = await db
      .insert(displays)
      .values({ userId: user.id, name: 'Kitchen Display' })
      .returning({
        id: displays.id,
        displayId: displays.displayId,
        name: displays.name,
        createdAt: displays.createdAt,
      });

    if (!created) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to create display' }) };
    }

    const publicDisplayId = created.displayId;
    const updated = await db
      .update(displayPairing)
      .set({ displayId: publicDisplayId })
      .where(eq(displayPairing.code, code))
      .returning({ code: displayPairing.code, displayId: displayPairing.displayId });

    if (!updated.length) {
      console.error('Claim: pairing row update affected 0 rows', { code });
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to link device' }) };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        id: created.id,
        display_id: publicDisplayId,
        name: created.name,
        created_at: created.createdAt,
      }),
    };
  } catch (err) {
    console.error('Claim error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server error' }) };
  }
};
