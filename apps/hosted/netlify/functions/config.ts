import type { Handler } from '@netlify/functions';
import { eq, sql } from 'drizzle-orm';
import { getDb, displays, displayConfigs, displayCollaborators, users } from '../../src/db';
import { writeStoredConfig } from '../../src/displayDocumentBridge';
import { AUTH_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from './_shared/http';
import { requireGoogleId } from './_shared/googleAuth';

function isDebugEnabled(event: Parameters<Handler>[0]): boolean {
  const queryDebug = event.queryStringParameters?.debug === '1';
  const envDebug = process.env.DEBUG_CONFIG === '1';
  return queryDebug || envDebug;
}

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
      const written = writeStoredConfig(rawBody);
      if (!written.ok) {
        return errorResponse(400, 'Invalid config payload', AUTH_JSON_HEADERS, {
          details: written.errors,
        });
      }
      const db = getDb();

      const ownerRows = await db
        .select({ id: displays.id, name: displays.name })
        .from(displays)
        .innerJoin(users, eq(users.id, displays.userId))
        .where(sql`${displays.id} = ${displayId}::uuid AND ${users.googleId} = ${googleId}`);

      const collabRows =
        ownerRows.length > 0
          ? []
          : await db
              .select({ id: displays.id, name: displays.name })
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

      const displayName = ownerRows[0]?.name ?? collabRows[0]?.name;
      const config =
        displayName && displayName.length > 0
          ? { ...written.document, name: displayName }
          : written.document;

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
