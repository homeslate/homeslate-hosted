/**
 * photo-store — store a Google Photos image in Netlify Blobs.
 *
 * POST /api/photo-store
 * Authorization: Bearer <google-access-token>
 * Body: { "baseUrl": "<Google Photos baseUrl>", "size": "w800-h600" }
 *
 * Fetches the image from Google server-side (avoiding CORS), stores it in
 * Netlify Blobs, and returns the blob key. The key can then be used to serve
 * the image via /api/photo-proxy?key=<key> without any authentication.
 *
 * If the key already exists in Blobs the upload is skipped and the existing
 * key is returned immediately (idempotent).
 */
import type { Handler } from '@netlify/functions';
import { getStore, connectLambda } from '@netlify/blobs';
import { createHash } from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyToken(accessToken: string): Promise<void> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Invalid token');
  const data = await res.json() as { aud: string };
  if (data.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Token audience mismatch');
}

/** Derive a stable, filesystem-safe key from the baseUrl + size. */
function makeBlobKey(baseUrl: string, size: string): string {
  return createHash('sha256').update(`${baseUrl}|${size}`).digest('hex');
}

function shortKey(key: string): string {
  return key.slice(0, 8);
}

export const handler: Handler = async (event) => {
  // connectLambda reads event.blobs which Netlify injects at runtime but
  // isn't declared in the @netlify/functions HandlerEvent type.
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Validate bearer token
  const authHeader = event.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const accessToken = authHeader.slice(7);

  try {
    await verifyToken(accessToken);
  } catch {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  // Parse body
  let baseUrl: string;
  let size: string;
  try {
    const body = JSON.parse(event.body ?? '{}') as { baseUrl?: string; size?: string };
    if (!body.baseUrl) throw new Error('Missing baseUrl');
    baseUrl = body.baseUrl;
    size = body.size ?? 'w800-h600';
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Only allow Google Photos / Google user content domains
  const allowed = /^https:\/\/(lh\d+\.googleusercontent\.com|photos\.googleapis\.com)\//;
  if (!allowed.test(baseUrl)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'URL not allowed' }) };
  }

  const key = makeBlobKey(baseUrl, size);
  const store = getStore('google-photos');

  // Check if already stored — idempotent
  const existing = await store.getWithMetadata(key);
  if (existing !== null) {
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ key }),
    };
  }

  // Fetch the image from Google with the user's token
  const fetchUrl = `${baseUrl}=${size}`;
  const imgRes = await fetch(fetchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!imgRes.ok) {
    return {
      statusCode: imgRes.status,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: `Google Photos fetch failed: ${imgRes.status}` }),
    };
  }

  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
  const arrayBuffer = await imgRes.arrayBuffer();

  // Store in Netlify Blobs with content-type metadata.
  // Pass arrayBuffer directly — BlobInput accepts ArrayBuffer.
  await store.set(key, arrayBuffer, {
    metadata: { contentType },
  });

  // Best-effort propagation check: wait briefly until the just-written key can
  // be read back. This reduces immediate 404s from /api/photo-proxy right
  // after upload completes.
  const maxReadChecks = 4;
  const readCheckStart = Date.now();
  let readable = false;
  for (let attempt = 0; attempt <= maxReadChecks; attempt++) {
    const written = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (written !== null) {
      readable = true;
      if (attempt > 0) {
        console.info(
          `[photo-store] blob readable after retry key=${shortKey(key)} attempt=${attempt} waitMs=${Date.now() - readCheckStart}`
        );
      }
      break;
    }
    if (attempt < maxReadChecks) {
      await sleep(150 * Math.pow(2, attempt));
    }
  }

  if (!readable) {
    console.warn(
      `[photo-store] blob not readable after retries key=${shortKey(key)} checks=${maxReadChecks + 1} waitMs=${Date.now() - readCheckStart}`
    );
  }

  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ key }),
  };
};
