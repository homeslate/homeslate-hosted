import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

// Public endpoint — returns the display config for a given display_id.
// No authentication required; used by the display device for polling.
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
      SELECT dc.config, dc.updated_at
      FROM display_configs dc
      JOIN users u ON u.id = dc.user_id
      WHERE u.display_id = ${displayId}::uuid
    `;
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(rows[0] ?? { config: null }),
    };
  } catch (err) {
    console.error('Display fetch error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server error' }) };
  }
};
