import type { Handler } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, displayConfigs, displays } from '../../src/db';
import { readStoredConfig, writeStoredConfig } from '../../src/displayDocumentBridge';
import type { NotesPatchRequest } from '../../src/types/api';
import { PUBLIC_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from './_shared/http';

const StickyNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string().min(1),
});

const NotesBodySchema: z.ZodType<NotesPatchRequest> = z.object({
  notes: z.array(StickyNoteSchema),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(PUBLIC_JSON_HEADERS);
  }

  if (event.httpMethod === 'PATCH') {
    try {
      const publicDisplayId = event.queryStringParameters?.publicDisplayId;
      const layoutId = event.queryStringParameters?.layoutId;

      if (!publicDisplayId || !layoutId) {
        return errorResponse(400, 'Missing publicDisplayId or layoutId', PUBLIC_JSON_HEADERS);
      }

      let body: unknown;
      try {
        body = JSON.parse(event.body ?? '{}');
      } catch {
        return errorResponse(400, 'Invalid JSON body', PUBLIC_JSON_HEADERS);
      }
      const parsed = NotesBodySchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(400, 'Invalid notes payload', PUBLIC_JSON_HEADERS, {
          details: parsed.error.flatten(),
        });
      }
      const notes = parsed.data.notes;

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

      const { document } = readStoredConfig(config);
      const next: typeof document = {
        ...document,
        views: document.views.map((view) =>
          view.id === layoutId ? { ...view, notes } : view
        ),
      };
      const written = writeStoredConfig(next);
      if (!written.ok) {
        return errorResponse(400, 'Invalid notes payload', PUBLIC_JSON_HEADERS, {
          details: written.errors,
        });
      }
      await db
        .update(displayConfigs)
        .set({ config: written.document, updatedAt: new Date().toISOString() })
        .where(eq(displayConfigs.displayId, configDisplayId));

      return jsonResponse(200, { ok: true }, PUBLIC_JSON_HEADERS);
    } catch (err) {
      console.error('Notes save error:', err);
      return errorResponse(500, 'Failed to save notes', PUBLIC_JSON_HEADERS);
    }
  }

  return errorResponse(405, 'Method not allowed', PUBLIC_JSON_HEADERS);
};
