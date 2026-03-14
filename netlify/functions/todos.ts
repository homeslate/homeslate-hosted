import type { Handler } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, displayConfigs, displays } from '../../src/db';
import type { TodosPatchRequest } from '../../src/types/api';
import { PUBLIC_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from './_shared/http';

const TodoItemSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  checked: z.boolean(),
});

const TodoBodySchema: z.ZodType<TodosPatchRequest> = z.object({
  items: z.array(TodoItemSchema),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(PUBLIC_JSON_HEADERS);
  }

  if (event.httpMethod === 'PATCH') {
    try {
      const publicDisplayId = event.queryStringParameters?.publicDisplayId;
      const layoutId = event.queryStringParameters?.layoutId;
      const widgetId = event.queryStringParameters?.widgetId;

      if (!publicDisplayId || !layoutId || !widgetId) {
        return errorResponse(400, 'Missing publicDisplayId, layoutId, or widgetId', PUBLIC_JSON_HEADERS);
      }

      let body: unknown;
      try {
        body = JSON.parse(event.body ?? '{}');
      } catch {
        return errorResponse(400, 'Invalid JSON body', PUBLIC_JSON_HEADERS);
      }
      const parsed = TodoBodySchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(400, 'Invalid todos payload', PUBLIC_JSON_HEADERS, {
          details: parsed.error.flatten(),
        });
      }
      const items = parsed.data.items;

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
        return errorResponse(404, 'Display not found', PUBLIC_JSON_HEADERS);
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

      return jsonResponse(200, { ok: true }, PUBLIC_JSON_HEADERS);
    } catch (err) {
      console.error('Todos save error:', err);
      return errorResponse(500, 'Failed to save todos', PUBLIC_JSON_HEADERS);
    }
  }

  return errorResponse(405, 'Method not allowed', PUBLIC_JSON_HEADERS);
};
