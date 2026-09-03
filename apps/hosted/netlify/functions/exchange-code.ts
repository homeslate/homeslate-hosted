import type { Handler } from '@netlify/functions';
import { exchangeAuthorizationCode } from '@homeslate/google';
import { eq, sql } from 'drizzle-orm';
import { getDb, users, displays } from '../../src/db';
import { verifyGoogleToken } from './_shared/googleAuth';
import { googleOAuthCredentials } from './_shared/googleClient';
import { errorResponse, jsonResponse, optionsResponse } from './_shared/http';

const EXCHANGE_CODE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(EXCHANGE_CODE_HEADERS);
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed', EXCHANGE_CODE_HEADERS);
  }

  // CSRF protection for popup-mode code flow (see Google GIS code model guide).
  const requestedWith = event.headers['x-requested-with'] ?? event.headers['X-Requested-With'];
  if (requestedWith !== 'XmlHttpRequest') {
    return errorResponse(403, 'Forbidden', EXCHANGE_CODE_HEADERS);
  }

  let body: { code?: string; redirect_uri?: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return errorResponse(400, 'Invalid JSON', EXCHANGE_CODE_HEADERS);
  }

  const { code, redirect_uri: redirectUri } = body;
  if (!code || !redirectUri) {
    return errorResponse(400, 'Missing code or redirect_uri', EXCHANGE_CODE_HEADERS);
  }

  try {
    const { clientId, clientSecret } = googleOAuthCredentials();
    const grant = await exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
    const accessToken = grant.accessToken;
    const refreshToken = grant.refreshToken;
    const expiresIn = grant.expiresIn;

    const tokenInfo = await verifyGoogleToken(accessToken);
    const googleId = tokenInfo.sub;
    const email = tokenInfo.email;
    const exp = tokenInfo.exp ? parseInt(tokenInfo.exp, 10) : null;
    if (!email) {
      return errorResponse(401, 'Authentication failed', EXCHANGE_CODE_HEADERS);
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoRes.ok) {
      return errorResponse(401, 'Failed to fetch user profile', EXCHANGE_CODE_HEADERS);
    }
    const { name, picture } = (await userInfoRes.json()) as { name: string; picture: string };

    const db = getDb();
    const expiresAt = exp ? new Date(exp * 1000).toISOString() : new Date(Date.now() + expiresIn * 1000).toISOString();

    const values = {
      googleId,
      email,
      name,
      picture,
      refreshToken: refreshToken ?? undefined,
      accessToken,
      accessTokenExpiresAt: expiresAt,
    };

    const [user] = await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.googleId,
        set: {
          email: sql`excluded.email`,
          name: sql`excluded.name`,
          picture: sql`excluded.picture`,
          refreshToken: refreshToken
            ? sql`COALESCE(NULLIF(excluded.refresh_token, ''), ${users.refreshToken})`
            : users.refreshToken,
          accessToken: sql`excluded.access_token`,
          accessTokenExpiresAt: sql`excluded.access_token_expires_at`,
        },
      })
      .returning({ id: users.id, email: users.email, name: users.name, picture: users.picture, plan: users.plan });

    if (!user) {
      throw new Error('Failed to upsert user');
    }

    const [existingDisplay] = await db
      .select({ id: displays.id })
      .from(displays)
      .where(eq(displays.userId, user.id))
      .limit(1);

    if (!existingDisplay) {
      await db.insert(displays).values({ userId: user.id, name: 'Homeslate' });
    }

    if (!refreshToken) {
      console.warn('[exchange-code] Google did not return a refresh token; display calendar will stop working when the access token expires');
    } else {
      console.info('[exchange-code] stored refresh token for display calendar', {
        userId: user.id,
        refreshTokenLength: refreshToken.length,
      });
    }

    return jsonResponse(
      200,
      {
        access_token: accessToken,
        expires_in: expiresIn,
        refresh_token: refreshToken,
        user: user,
      },
      EXCHANGE_CODE_HEADERS
    );
  } catch (err) {
    console.error('Auth code exchange error:', err);
    return errorResponse(401, 'Authentication failed', EXCHANGE_CODE_HEADERS);
  }
};
