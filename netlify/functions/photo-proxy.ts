/**
 * photo-proxy — server-side proxy for Google Photos image URLs.
 *
 * Google Photos `baseUrl` values (lh3.googleusercontent.com) block
 * browser-initiated fetches with an Authorization header due to CORS.
 * This function fetches the image server-side and streams it back to the
 * browser, avoiding the CORS restriction entirely.
 *
 * GET /api/photo-proxy?url=<encoded-baseUrl>&size=w1920-h1080
 * Authorization: Bearer <google-access-token>
 *
 * The token is validated with Google before the image is fetched to prevent
 * this endpoint being used as an open proxy.
 */
import type { Handler } from '@netlify/functions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

async function verifyToken(accessToken: string): Promise<void> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Invalid token');
  const data = await res.json() as { aud: string };
  if (data.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Token audience mismatch');
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Validate bearer token
  const authHeader = event.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const accessToken = authHeader.slice(7);

  try {
    await verifyToken(accessToken);
  } catch {
    return { statusCode: 401, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  // Validate and decode the image URL parameter
  const rawUrl = event.queryStringParameters?.url;
  if (!rawUrl) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing url parameter' }) };
  }

  let imageUrl: string;
  try {
    imageUrl = decodeURIComponent(rawUrl);
  } catch {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid url parameter' }) };
  }

  // Only allow Google Photos / Google user content domains
  const allowed = /^https:\/\/(lh\d+\.googleusercontent\.com|photos\.googleapis\.com)\//;
  if (!allowed.test(imageUrl)) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'URL not allowed' }) };
  }

  // Append size suffix if a custom size param was supplied, otherwise use default
  const size = event.queryStringParameters?.size ?? 'w1920-h1080';
  const fetchUrl = `${imageUrl}=${size}`;

  // Fetch the image with the user's token
  const imgRes = await fetch(fetchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!imgRes.ok) {
    return {
      statusCode: imgRes.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Upstream error: ${imgRes.status}` }),
    };
  }

  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
  const arrayBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return {
    statusCode: 200,
    headers: {
      ...CORS,
      'Content-Type': contentType,
      // Cache for 1 hour — baseUrls are stable for at least 60 min
      'Cache-Control': 'private, max-age=3600',
    },
    body: base64,
    isBase64Encoded: true,
  };
};
