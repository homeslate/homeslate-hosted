/**
 * photo-upload — store an arbitrary image in Netlify Blobs.
 *
 * POST /api/photo-upload
 * Body (multipart/form-data or JSON):
 *   - JSON mode:   { "dataUrl": "data:image/...,base64..." }
 *   - URL mode:    { "url": "https://..." }
 *
 * No Google auth required — any image can be stored this way.
 * Returns { key, filename } where key can be used with /api/photo-proxy.
 *
 * For URL mode the server fetches the image to avoid CORS issues.
 */
import type { Handler } from '@netlify/functions';
import { getStore, connectLambda } from '@netlify/blobs';
import { createHash, randomBytes } from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function makeBlobKey(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Extract mime type and binary buffer from a data URL. */
function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Invalid data URL format');
  const contentType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { contentType, buffer };
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
  };
  return map[mime] ?? 'jpg';
}

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body: { dataUrl?: string; url?: string; filename?: string };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const store = getStore('google-photos'); // reuse same blob store

  try {
    // ── URL mode ─────────────────────────────────────────────────────────────
    if (body.url) {
      const url = body.url;

      // Basic URL validation
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid URL' }) };
      }
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Only http/https URLs allowed' }) };
      }

      const key = makeBlobKey(`url|${url}`);

      // Idempotent — return key if already stored
      const existing = await store.getWithMetadata(key);
      if (existing !== null) {
        const filename = (existing.metadata?.filename as string | undefined) ?? 'photo.jpg';
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ key, filename }) };
      }

      // Fetch remote image
      const imgRes = await fetch(url);
      if (!imgRes.ok) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: `Failed to fetch URL: ${imgRes.status}` }) };
      }

      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'URL does not point to an image' }) };
      }

      const arrayBuffer = await imgRes.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_BYTES) {
        return { statusCode: 413, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Image too large (max 20 MB)' }) };
      }

      // Derive a filename from the URL path or content-type
      const urlFilename = body.filename ?? parsedUrl.pathname.split('/').pop() ?? `photo.${mimeToExt(contentType)}`;

      await store.set(key, arrayBuffer, { metadata: { contentType, filename: urlFilename } });
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ key, filename: urlFilename }) };
    }

    // ── Data URL (device upload) mode ─────────────────────────────────────────
    if (body.dataUrl) {
      const { contentType, buffer } = parseDataUrl(body.dataUrl);

      if (!contentType.startsWith('image/')) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Only image files are allowed' }) };
      }
      if (buffer.byteLength > MAX_BYTES) {
        return { statusCode: 413, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Image too large (max 20 MB)' }) };
      }

      // Key is hash of the raw data so re-uploading same file is idempotent
      const key = makeBlobKey(`upload|${createHash('sha256').update(buffer).digest('hex')}`);
      const filename = body.filename ?? `photo-${randomBytes(4).toString('hex')}.${mimeToExt(contentType)}`;

      const existing = await store.getWithMetadata(key);
      if (existing !== null) {
        const storedFilename = (existing.metadata?.filename as string | undefined) ?? filename;
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ key, filename: storedFilename }) };
      }

      const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      await store.set(key, arrayBuf, { metadata: { contentType, filename } });
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ key, filename }) };
    }

    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Provide either "url" or "dataUrl"' }) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: message }) };
  }
};
