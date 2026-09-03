import type { Handler } from '@netlify/functions';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, users, displays, displayCollaborators, displayInvites } from '../../apps/hosted/src/db';
import { AUTH_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from './_shared/http';
import { verifyGoogleToken } from './_shared/googleAuth';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(AUTH_JSON_HEADERS);
  }

  const authHeader = event.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(401, 'Unauthorized', AUTH_JSON_HEADERS);
  }

  const accessToken = authHeader.slice(7);

  try {
    const tokenInfo = await verifyGoogleToken(accessToken);
    const googleId = tokenInfo.sub;
    const email = tokenInfo.email;
    const exp = tokenInfo.exp ? parseInt(tokenInfo.exp, 10) : null;
    if (!email) {
      return errorResponse(401, 'Authentication failed', AUTH_JSON_HEADERS);
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { name, picture } = await userInfoRes.json() as { name: string; picture: string };

    const db = getDb();

    const refreshToken = event.headers['x-refresh-token'];

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

    // Persist current access token for display-calendar fallback when no refresh token is available.
    // exp is epoch seconds from Google tokeninfo.
    const expiresAt = exp ? new Date(exp * 1000).toISOString() : null;
    await db.execute(sql`
      UPDATE users
      SET
        access_token = ${accessToken},
        access_token_expires_at = ${expiresAt}::timestamptz
      WHERE google_id = ${googleId}
    `);

    // Ensure user has at least one display
    const [existingDisplay] = await db
      .select({ id: displays.id })
      .from(displays)
      .where(eq(displays.userId, user.id))
      .limit(1);

    if (!existingDisplay) {
      await db.insert(displays).values({ userId: user.id, name: 'Homeslate' });
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

    return jsonResponse(200, user, AUTH_JSON_HEADERS);
  } catch (err) {
    console.error('Auth error:', err);
    return errorResponse(401, 'Authentication failed', AUTH_JSON_HEADERS);
  }
};
