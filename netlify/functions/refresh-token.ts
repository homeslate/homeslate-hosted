import type { Handler } from '@netlify/functions';
import { sql } from 'drizzle-orm';
import { getDb } from '../../src/db';
import { userTokenPersistFields } from '../../src/services/displayCalendarAuth';
import { AUTH_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from './_shared/http';
import { exchangeRefreshToken } from './_shared/googleTokens';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(AUTH_JSON_HEADERS);
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed', AUTH_JSON_HEADERS);
  }

  let body: { refresh_token?: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return errorResponse(400, 'Invalid JSON', AUTH_JSON_HEADERS);
  }

  const { refresh_token: refreshToken } = body;
  if (!refreshToken) {
    return errorResponse(400, 'Missing refresh token', AUTH_JSON_HEADERS);
  }

  try {
    const tokenData = await exchangeRefreshToken(refreshToken);
    const fields = userTokenPersistFields(tokenData);

    try {
      const db = getDb();
      if (fields.rotatedRefreshToken) {
        await db.execute(sql`
          UPDATE users
          SET access_token = ${fields.accessToken},
              access_token_expires_at = ${fields.expiresAt}::timestamptz,
              refresh_token = ${fields.rotatedRefreshToken}
          WHERE refresh_token = ${refreshToken}
        `);
      } else {
        await db.execute(sql`
          UPDATE users
          SET access_token = ${fields.accessToken},
              access_token_expires_at = ${fields.expiresAt}::timestamptz
          WHERE refresh_token = ${refreshToken}
        `);
      }
    } catch (persistErr) {
      console.warn('[refresh-token] failed to persist access token for displays', persistErr);
    }

    return jsonResponse(
      200,
      {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        ...(fields.rotatedRefreshToken ? { refresh_token: fields.rotatedRefreshToken } : {}),
      },
      AUTH_JSON_HEADERS
    );
  } catch (err) {
    console.error('[refresh-token] exchange failed:', err);
    return errorResponse(401, 'Invalid refresh token', AUTH_JSON_HEADERS);
  }
};
