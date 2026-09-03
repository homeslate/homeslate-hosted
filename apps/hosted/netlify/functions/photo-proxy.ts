/**
 * photo-proxy — serve a stored Google Photos image from Netlify Blobs.
 *
 * GET /api/photo-proxy?key=<blobKey>
 *
 * No authentication required — images are stored in Netlify Blobs during the
 * authenticated pick flow (via /api/photo-store) and served publicly by key.
 * The key is a SHA-256 hash of the original baseUrl + size, so it is not
 * guessable without knowing the original URL.
 */
import type { Handler } from '@netlify/functions';
import { getStore, connectLambda } from '@netlify/blobs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const key = event.queryStringParameters?.key;
  if (!key) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Missing key parameter' }) };
  }

  const store = getStore('google-photos');
  const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });

  if (result === null) {
    return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Image not found' }) };
  }

  const contentType = (result.metadata?.contentType as string | undefined) ?? 'image/jpeg';
  const base64 = Buffer.from(result.data as ArrayBuffer).toString('base64');

  return {
    statusCode: 200,
    headers: {
      ...CORS,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: base64,
    isBase64Encoded: true,
  };
};
