import type { Handler } from '@netlify/functions';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, users, displays, displayCollaborators, displayInvites } from '../../src/db';

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

    const db = getDb();

    const refreshToken = event.headers['x-refresh-token'];

    // Idempotent migration: ensure refresh_token column exists
    if (refreshToken) {
      try {
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT`);
      } catch {
        // Column might already exist, ignore error
      }
    }

    // Upsert user
    const values = { googleId, email, name, picture };
    const insertValues = refreshToken ? { ...values, refreshToken } : values;

    const [user] = await db
      .insert(users)
      .values(insertValues)
      .onConflictDoUpdate({
        target: users.googleId,
        set: refreshToken
          ? {
              email: sql`excluded.email`,
              name: sql`excluded.name`,
              picture: sql`excluded.picture`,
              refreshToken: sql`COALESCE(NULLIF(excluded.refresh_token, ''), ${users.refreshToken})`,
            }
          : {
              email: sql`excluded.email`,
              name: sql`excluded.name`,
              picture: sql`excluded.picture`,
            },
      })
      .returning({ id: users.id, email: users.email, name: users.name, picture: users.picture });

    if (!user) {
      throw new Error('Failed to upsert user');
    }

    // Ensure user has at least one display
    const [existingDisplay] = await db
      .select({ id: displays.id })
      .from(displays)
      .where(eq(displays.userId, user.id))
      .limit(1);

    if (!existingDisplay) {
      await db.insert(displays).values({ userId: user.id, name: 'Kitchen Display' });
    }

    // Redeem any pending invites for this email (idempotent)
    try {
      const pendingInvites = await db
        .select({ displayId: displayInvites.displayId })
        .from(displayInvites)
        .where(sql`LOWER(${displayInvites.invitedEmail}) = LOWER(${email})`);

      for (const invite of pendingInvites) {
        await db
          .insert(displayCollaborators)
          .values({ displayId: invite.displayId, userId: user.id })
          .onConflictDoNothing({ target: [displayCollaborators.displayId, displayCollaborators.userId] });

        await db
          .delete(displayInvites)
          .where(
            and(
              eq(displayInvites.displayId, invite.displayId),
              sql`LOWER(${displayInvites.invitedEmail}) = LOWER(${email})`
            )
          );
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
