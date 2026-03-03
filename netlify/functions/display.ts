import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

// Public endpoint — returns the display config for a given display_id (public polling UUID).
// If the display has a passcode set, the caller must supply ?passcode=<4-digit-pin>.
// Returns { passcodeRequired: true } (HTTP 401) when passcode is missing/wrong.
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const displayId = event.queryStringParameters?.id;
  if (!displayId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing display id' }) };
  }

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const rows = await sql`
      SELECT dc.config, dc.updated_at, d.passcode_hash
      FROM display_configs dc
      JOIN displays d ON d.id = dc.display_id
      WHERE d.display_id = ${displayId}::uuid
    `;

    if (rows.length === 0) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ config: null }),
      };
    }

    const row = rows[0] as { config: unknown; updated_at: string; passcode_hash: string | null };

    if (row.passcode_hash) {
      const provided = event.queryStringParameters?.passcode;
      if (!provided || hashPin(provided) !== row.passcode_hash) {
        return {
          statusCode: 401,
          headers: CORS,
          body: JSON.stringify({ passcodeRequired: true }),
        };
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ config: row.config, updated_at: row.updated_at }),
    };
  } catch (err) {
    console.error('Display fetch error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server error' }) };
  }
};
