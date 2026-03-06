import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod === 'PATCH') {
    try {
      const publicDisplayId = event.queryStringParameters?.publicDisplayId;
      const layoutId = event.queryStringParameters?.layoutId;
      const widgetId = event.queryStringParameters?.widgetId;

      if (!publicDisplayId || !layoutId || !widgetId) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({ error: 'Missing publicDisplayId, layoutId, or widgetId' }),
        };
      }

      const body = JSON.parse(event.body ?? '{}') as { items?: TodoItem[] };
      const items = body.items ?? [];

      const sql = neon(process.env.DATABASE_URL!);

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

      const layouts = (config.layouts ?? []) as Array<{
        id: string;
        widgets?: Array<{ id: string; type: string; config?: Record<string, unknown> }>;
      }>;

      const updatedLayouts = layouts.map((layout) => {
        if (layout.id !== layoutId) return layout;
        const widgets = layout.widgets ?? [];
        const updatedWidgets = widgets.map((w) =>
          w.id === widgetId ? { ...w, config: { ...w.config, items } } : w
        );
        return { ...layout, widgets: updatedWidgets };
      });

      const newConfig = { ...config, layouts: updatedLayouts };

      await sql`
        UPDATE display_configs
        SET config = ${JSON.stringify(newConfig)}::jsonb,
            updated_at = NOW()
        WHERE display_id = ${config_display_id}::uuid
      `;

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('Todos save error:', err);
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: 'Failed to save todos' }),
      };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
