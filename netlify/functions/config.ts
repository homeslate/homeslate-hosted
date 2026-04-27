import type { Handler } from '@netlify/functions';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, displays, displayConfigs, displayCollaborators, users } from '../../src/db';
import type { ConfigUpsertRequest } from '../../src/types/api';
import { validateThemeDocument } from '../../src/themes/themeDocumentValidation';
import { AUTH_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from './_shared/http';
import { requireGoogleId } from './_shared/googleAuth';

function isDebugEnabled(event: Parameters<Handler>[0]): boolean {
  const queryDebug = event.queryStringParameters?.debug === '1';
  const envDebug = process.env.DEBUG_CONFIG === '1';
  return queryDebug || envDebug;
}

const ConfigBodySchema = z
  .object({
    layouts: z.array(z.unknown()),
    activeLayoutId: z.string().nullable(),
    rotationEnabled: z.boolean(),
    rotationIntervalMs: z.number().int().positive(),
    themes: z.array(z.unknown()).optional(),
    activeThemeId: z.string().nullable().optional(),
    colorMode: z.enum(['light', 'dark']).optional(),
    stickyNotesEnabled: z.boolean().optional(),
    holidayEffectsEnabled: z.boolean().optional(),
    holidayPreviewId: z
      .enum([
        'new-years-day',
        'valentines-day',
        'st-patricks-day',
        'independence-day',
        'halloween',
        'thanksgiving',
        'christmas',
        'new-years-eve',
      ])
      .optional(),
  })
  .passthrough();

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(AUTH_JSON_HEADERS);
  }

  if (event.httpMethod === 'PUT') {
    const debug = isDebugEnabled(event);
    try {
      const googleId = await requireGoogleId(event.headers['authorization']);
      const displayId = event.queryStringParameters?.displayId;
      if (!displayId) {
        return errorResponse(400, 'Missing displayId', AUTH_JSON_HEADERS, debug ? { debug: { missingDisplayId: true } } : undefined);
      }
      let rawBody: unknown;
      try {
        rawBody = JSON.parse(event.body ?? '{}');
      } catch {
        return errorResponse(400, 'Invalid JSON body', AUTH_JSON_HEADERS);
      }
      const parsedConfig = ConfigBodySchema.safeParse(rawBody);
      if (!parsedConfig.success) {
        return errorResponse(400, 'Invalid config payload', AUTH_JSON_HEADERS, {
          details: parsedConfig.error.flatten(),
        });
      }
      if (parsedConfig.data.themes !== undefined) {
        const issues = parsedConfig.data.themes.flatMap((document, index) => {
          const validation = validateThemeDocument(document);
          if (validation.ok) return [];
          return validation.issues.map((issue) => ({
            path: `themes[${index}].${issue.path}`,
            message: issue.message,
          }));
        });
        if (issues.length > 0) {
          return errorResponse(400, 'Invalid themes payload', AUTH_JSON_HEADERS, {
            details: { issues },
          });
        }
      }
      if (
        parsedConfig.data.themes !== undefined &&
        parsedConfig.data.activeThemeId !== undefined &&
        parsedConfig.data.activeThemeId !== null
      ) {
        const activeThemeId = parsedConfig.data.activeThemeId;
        const ids = parsedConfig.data.themes
          .map((document) => (typeof document === 'object' && document && 'id' in document ? (document as { id?: unknown }).id : undefined))
          .filter((id): id is string => typeof id === 'string');
        if (!ids.includes(activeThemeId)) {
          return errorResponse(400, 'activeThemeId must exist in themes', AUTH_JSON_HEADERS);
        }
      }
      const config: ConfigUpsertRequest = {
        ...parsedConfig.data,
        themes: parsedConfig.data.themes as ConfigUpsertRequest['themes'],
      };
      const db = getDb();

      const ownerRows = await db
        .select({ id: displays.id })
        .from(displays)
        .innerJoin(users, eq(users.id, displays.userId))
        .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

      const collabRows =
        ownerRows.length > 0
          ? []
          : await db
              .select({ id: displays.id })
              .from(displayCollaborators)
              .innerJoin(users, eq(users.id, displayCollaborators.userId))
              .innerJoin(displays, eq(displays.id, displayCollaborators.displayId))
              .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

      if (ownerRows.length === 0 && collabRows.length === 0) {
        if (debug) {
          console.info('config debug: access denied', {
            displayId,
            ownerRows: ownerRows.length,
            collaboratorRows: collabRows.length,
          });
        }
        return errorResponse(
          403,
          'Forbidden',
          AUTH_JSON_HEADERS,
          debug
            ? {
                debug: {
                  ownerRows: ownerRows.length,
                  collaboratorRows: collabRows.length,
                },
              }
            : undefined
        );
      }

      await db
        .insert(displayConfigs)
        .values({ displayId, config })
        .onConflictDoUpdate({
          target: displayConfigs.displayId,
          set: { config, updatedAt: new Date().toISOString() },
        });

      if (debug) {
        console.info('config debug: config saved', {
          displayId,
          asOwner: ownerRows.length > 0,
        });
      }

      return jsonResponse(200, { ok: true }, AUTH_JSON_HEADERS);
    } catch (err) {
      console.error('Config save error:', err);
      return errorResponse(400, 'Failed to save', AUTH_JSON_HEADERS, debug ? { debug: { method: 'PUT' } } : undefined);
    }
  }

  return errorResponse(405, 'Method not allowed', AUTH_JSON_HEADERS);
};
