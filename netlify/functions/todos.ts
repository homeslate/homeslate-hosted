import type { Handler } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { getDb, displayConfigs, displays } from '../../src/db';

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

      const db = getDb();

      const [row] = await db
        .select({
          config: displayConfigs.config,
          configDisplayId: displayConfigs.displayId,
        })
        .from(displayConfigs)
        .innerJoin(displays, eq(displays.id, displayConfigs.displayId))
        .where(eq(displays.displayId, publicDisplayId));

      if (!row) {
        return {
          statusCode: 404,
          headers: CORS,
          body: JSON.stringify({ error: 'Display not found' }),
        };
      }

      const { config, configDisplayId } = row;

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

      await db
        .update(displayConfigs)
        .set({ config: newConfig, updatedAt: new Date() })
        .where(eq(displayConfigs.displayId, configDisplayId));

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
