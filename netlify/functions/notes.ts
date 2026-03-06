import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod === 'PATCH') {
    try {
      const publicDisplayId = event.queryStringParameters?.publicDisplayId;
      const layoutId = event.queryStringParameters?.layoutId;

      if (!publicDisplayId || !layoutId) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({ error: 'Missing publicDisplayId or layoutId' }),
        };
      }

      const body = JSON.parse(event.body ?? '{}') as { notes?: unknown[] };
      const notes = body.notes ?? [];

      const sql = neon(process.env.DATABASE_URL!);

      // Fetch current config for the given public display_id
      const rows = await sql`
        SELECT dc.config, dc.display_id AS config_display_id
        FROM display_configs dc
        JOIN displays d ON d.id = dc.display_id
        WHERE d.display_id = ${publicDisplayId}
      `;

      if (rows.length === 0) {
        return {
          statusCode: 404,
          headers: CORS,
          body: JSON.stringify({ error: 'Display not found' }),
        };
      }

      const { config, config_display_id } = rows[0] as {
        config: Record<string, unknown>;
        config_display_id: string;
      };

      // Update the target layout's notes
      const layouts = (config.layouts ?? []) as Array<{ id: string; [k: string]: unknown }>;
      const updatedLayouts = layouts.map((layout) =>
        layout.id === layoutId ? { ...layout, notes } : layout
      );

      const newConfig = { ...config, layouts: updatedLayouts };

      await sql`
        UPDATE display_configs
        SET config = ${JSON.stringify(newConfig)}::jsonb,
            updated_at = NOW()
        WHERE display_id = ${config_display_id}::uuid
      `;

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('Notes save error:', err);
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: 'Failed to save notes' }),
      };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
