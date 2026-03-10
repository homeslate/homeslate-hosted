import type { Handler } from '@netlify/functions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body: { refresh_token?: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { refresh_token: refreshToken } = body;
  if (!refreshToken) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing refresh token' }) };
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials');
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server configuration error' }) };
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
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid refresh token' }) };
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      expires_in: number;
      scope: string;
      token_type: string;
    };

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
      }),
    };
  } catch (err) {
    console.error('Token refresh error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
