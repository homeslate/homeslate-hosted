import type { Handler } from '@netlify/functions';
import { eq, sql } from 'drizzle-orm';
import { getDb, displays, displayConfigs, displayCollaborators, users } from '../../src/db';

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
      const db = getDb();

      const ownerRows = await db
        .select({ id: displays.id })
        .from(displays)
        .innerJoin(users, eq(users.id, displays.userId))
        .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

      const collabRows =
        ownerRows.length > 0
          ? []
          : await db
              .select({ id: displays.id })
              .from(displayCollaborators)
              .innerJoin(users, eq(users.id, displayCollaborators.userId))
              .innerJoin(displays, eq(displays.id, displayCollaborators.displayId))
              .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

      if (ownerRows.length === 0 && collabRows.length === 0) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
      }

      await db
        .insert(displayConfigs)
        .values({ displayId, config })
        .onConflictDoUpdate({
          target: displayConfigs.displayId,
          set: { config, updatedAt: new Date() },
        });

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('Config save error:', err);
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Failed to save' }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
