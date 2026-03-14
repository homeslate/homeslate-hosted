import type { Handler } from '@netlify/functions';
import { AUTH_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from './_shared/http';

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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials');
      return errorResponse(500, 'Server configuration error', AUTH_JSON_HEADERS);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenRes.ok) {
      const error = await tokenRes.text();
      console.error('Google token refresh failed:', error);
      return errorResponse(401, 'Invalid refresh token', AUTH_JSON_HEADERS);
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      expires_in: number;
      scope: string;
      token_type: string;
    };

    return jsonResponse(
      200,
      {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
      },
      AUTH_JSON_HEADERS
    );
  } catch (err) {
    console.error('Token refresh error:', err);
    return errorResponse(500, 'Internal server error', AUTH_JSON_HEADERS);
  }
};
