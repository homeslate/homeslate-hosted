import type { Handler } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { getDb, displayConfigs, displays } from '../../src/db';

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

      const layouts = (config.layouts ?? []) as Array<{ id: string; [k: string]: unknown }>;
      const updatedLayouts = layouts.map((layout) =>
        layout.id === layoutId ? { ...layout, notes } : layout
      );

      const newConfig = { ...config, layouts: updatedLayouts };

      await db
        .update(displayConfigs)
        .set({ config: newConfig, updatedAt: new Date() })
        .where(eq(displayConfigs.displayId, configDisplayId));

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
