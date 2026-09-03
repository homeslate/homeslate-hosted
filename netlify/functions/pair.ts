import type { Handler } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { getDb, displayPairing } from '../../apps/hosted/src/db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const CODE_LENGTH = 6;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O, 1/I
const EXPIRY_MINUTES = 15;

function generateCode(): string {
  let code = '';
  const bytes = new Uint8Array(CODE_LENGTH);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return code;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const db = getDb();

  // POST /api/pair — create a new pairing code (no auth)
  if (event.httpMethod === 'POST') {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    try {
      await db.insert(displayPairing).values({
        code,
        expiresAt: expiresAt.toISOString(),
      });
      return {
        statusCode: 201,
        headers: CORS,
        body: JSON.stringify({ code, expiresAt: expiresAt.toISOString() }),
      };
    } catch (err) {
      console.error('Pair create error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to create pairing code' }) };
    }
  }

  // GET /api/pair?code=XXX — check pairing status (no auth)
  if (event.httpMethod === 'GET') {
    const code = event.queryStringParameters?.code?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || code.length !== CODE_LENGTH) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid or missing code' }) };
    }

    try {
      const [row] = await db
        .select({ displayId: displayPairing.displayId, expiresAt: displayPairing.expiresAt })
        .from(displayPairing)
        .where(eq(displayPairing.code, code));

      if (!row) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'invalid' }) };
      }
      const expiresAt = typeof row.expiresAt === 'string' ? new Date(row.expiresAt) : row.expiresAt;
      if (expiresAt.getTime() < Date.now()) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'expired' }) };
      }
      if (row.displayId) {
        return {
          statusCode: 200,
          headers: CORS,
          body: JSON.stringify({ status: 'claimed', displayId: row.displayId }),
        };
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ status: 'pending' }) };
    } catch (err) {
      console.error('Pair check error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server error' }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
