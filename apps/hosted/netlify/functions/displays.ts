import type { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import {
  getDb,
  users,
  displays,
  displayConfigs,
  displayCollaborators,
} from '../../src/db';
import { readStoredConfig } from '../../src/displayDocumentBridge';
import { checkCreateDisplayEntitlement } from '../../src/billing/checkCreateDisplayEntitlement';
import { EntitlementError } from '../../src/billing/entitlementError';
import { AUTH_JSON_HEADERS, entitlementResponse, errorResponse, jsonResponse, optionsResponse } from './_shared/http';
import { requireGoogleId } from './_shared/googleAuth';

function isDebugEnabled(event: Parameters<Handler>[0]): boolean {
  const queryDebug = event.queryStringParameters?.debug === '1';
  const envDebug = process.env.DEBUG_DISPLAYS === '1';
  return queryDebug || envDebug;
}

function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

function timestamp(value: unknown): number {
  return value instanceof Date ? value.getTime() : Date.parse(String(value));
}

function stripLegacyThemeFields(config: unknown): unknown {
  if (!config || typeof config !== 'object') return config;
  const {
    theme: _t,
    themeDocuments: _td,
    activeThemeDocumentId: _atd,
    ...rest
  } = config as Record<string, unknown>;
  void _t;
  void _td;
  void _atd;
  return rest;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(AUTH_JSON_HEADERS);
  }

  const db = getDb();
  const debug = isDebugEnabled(event);
  let googleId: string;
  try {
    googleId = await requireGoogleId(event.headers['authorization']);
  } catch {
    return errorResponse(401, 'Unauthorized', AUTH_JSON_HEADERS, debug ? { debug: { authHeaderPresent: !!event.headers['authorization'] } } : undefined);
  }

  // GET /api/displays — list user's owned displays + displays shared with them
  if (event.httpMethod === 'GET') {
    try {
      const ownerRows = await db
        .select({
          id: displays.id,
          displayId: displays.displayId,
          name: displays.name,
          createdAt: displays.createdAt,
          passcodeEnabled: sql<boolean>`(${displays.passcodeHash} IS NOT NULL)`.as('passcode_enabled'),
          config: displayConfigs.config,
          configUpdatedAt: displayConfigs.updatedAt,
          isOwner: sql<boolean>`true`.as('is_owner'),
          ownerPlan: users.plan,
        })
        .from(displays)
        .innerJoin(users, eq(users.id, displays.userId))
        .leftJoin(displayConfigs, eq(displayConfigs.displayId, displays.id))
        .where(eq(users.googleId, googleId));

      const collabRows = await db
        .select({
          id: displays.id,
          displayId: displays.displayId,
          name: displays.name,
          createdAt: displays.createdAt,
          passcodeEnabled: sql<boolean>`(${displays.passcodeHash} IS NOT NULL)`.as('passcode_enabled'),
          config: displayConfigs.config,
          configUpdatedAt: displayConfigs.updatedAt,
          isOwner: sql<boolean>`false`.as('is_owner'),
          ownerPlan: sql<string | null>`(SELECT plan FROM users WHERE id = ${displays.userId})`.as('owner_plan'),
        })
        .from(displayCollaborators)
        .innerJoin(users, eq(users.id, displayCollaborators.userId))
        .innerJoin(displays, eq(displays.id, displayCollaborators.displayId))
        .leftJoin(displayConfigs, eq(displayConfigs.displayId, displays.id))
        .where(eq(users.googleId, googleId));

      const rows = [...ownerRows, ...collabRows].sort(
        (a, b) =>
          timestamp(a.createdAt) -
          timestamp(b.createdAt)
      );

      const formatted = rows.map((r) => ({
        id: r.id,
        display_id: r.displayId,
        name: r.name,
        created_at: r.createdAt,
        passcode_enabled: r.passcodeEnabled,
        config: r.config == null ? null : readStoredConfig(stripLegacyThemeFields(r.config)).legacy,
        config_updated_at: r.configUpdatedAt,
        is_owner: r.isOwner,
        owner_plan: r.ownerPlan,
      }));

      if (debug) {
        console.info('displays debug: fetched displays', {
          ownerCount: ownerRows.length,
          collaboratorCount: collabRows.length,
          total: formatted.length,
        });
      }

      return jsonResponse(200, formatted, AUTH_JSON_HEADERS);
    } catch (err) {
      console.error('Displays fetch error:', err);
      return {
        ...errorResponse(500, 'Server error', AUTH_JSON_HEADERS, debug ? { debug: { method: 'GET' } } : undefined),
      };
    }
  }

  // POST /api/displays — create a new display
  if (event.httpMethod === 'POST') {
    try {
      const { name } = JSON.parse(event.body ?? '{}') as { name?: string };
      const displayName = name?.trim() || 'Homeslate';

      const [user] = await db
        .select({ id: users.id, plan: users.plan })
        .from(users)
        .where(eq(users.googleId, googleId));

      if (!user) {
        return {
          statusCode: 401,
          headers: AUTH_JSON_HEADERS,
          body: JSON.stringify({
            error: 'User not found',
            ...(debug ? { debug: { googleIdFound: !!googleId } } : {}),
          }),
        };
      }

      try {
        await checkCreateDisplayEntitlement(db, user.id, user.plan);
      } catch (err) {
        if (err instanceof EntitlementError) {
          return entitlementResponse(err, AUTH_JSON_HEADERS);
        }
        throw err;
      }

      const [created] = await db
        .insert(displays)
        .values({ userId: user.id, name: displayName })
        .returning({ id: displays.id, displayId: displays.displayId, name: displays.name, createdAt: displays.createdAt });

      if (!created) {
        return errorResponse(500, 'Failed to create', AUTH_JSON_HEADERS);
      }

      if (debug) {
        console.info('displays debug: created display', {
          displayId: created.id,
          name: created.name,
        });
      }

      return {
        statusCode: 201,
        headers: AUTH_JSON_HEADERS,
        body: JSON.stringify({
          id: created.id,
          display_id: created.displayId,
          name: created.name,
          created_at: created.createdAt,
        }),
      };
    } catch (err) {
      console.error('Display create error:', err);
      return {
        statusCode: 500,
        headers: AUTH_JSON_HEADERS,
        body: JSON.stringify({
          error: 'Failed to create',
          ...(debug ? { debug: { method: 'POST' } } : {}),
        }),
      };
    }
  }

  // PATCH /api/displays?id=<id> — rename a display or update its passcode
  if (event.httpMethod === 'PATCH') {
    try {
      const id = event.queryStringParameters?.id;
      if (!id) return errorResponse(400, 'Missing id', AUTH_JSON_HEADERS);
      const body = JSON.parse(event.body ?? '{}') as { name?: string; passcode?: string | null };

      if (!body.name?.trim() && !('passcode' in body)) {
        return errorResponse(400, 'Nothing to update', AUTH_JSON_HEADERS);
      }

      if ('passcode' in body && body.passcode !== null) {
        if (!/^\d{4}$/.test(body.passcode ?? '')) {
          return errorResponse(400, 'Passcode must be 4 digits', AUTH_JSON_HEADERS);
        }
      }

      const accessFilter = sql`(
        ${displays.userId} = (SELECT id FROM users WHERE google_id = ${googleId})
        OR EXISTS (
          SELECT 1 FROM display_collaborators dc2
          JOIN users u2 ON u2.id = dc2.user_id
          WHERE dc2.display_id = ${displays.id} AND u2.google_id = ${googleId}
        )
      )`;

      const updateSet: { name?: string; passcodeHash?: string | null } = {};
      if (body.name?.trim()) updateSet.name = body.name.trim();
      if ('passcode' in body) updateSet.passcodeHash = body.passcode !== null ? hashPin(body.passcode!) : null;

      const rows = await db
        .update(displays)
        .set(updateSet)
        .where(sql`${displays.id} = ${id}::uuid AND ${accessFilter}`)
        .returning({
          id: displays.id,
          displayId: displays.displayId,
          name: displays.name,
          createdAt: displays.createdAt,
          passcodeEnabled: sql<boolean>`(${displays.passcodeHash} IS NOT NULL)`.as('passcode_enabled'),
        });

      if (rows.length === 0) {
        return {
          statusCode: 404,
          headers: AUTH_JSON_HEADERS,
          body: JSON.stringify({
            error: 'Not found',
            ...(debug ? { debug: { id, accessibleByUser: false } } : {}),
          }),
        };
      }

      const r = rows[0];
      return {
        statusCode: 200,
        headers: AUTH_JSON_HEADERS,
        body: JSON.stringify({
          id: r.id,
          display_id: r.displayId,
          name: r.name,
          created_at: r.createdAt,
          passcode_enabled: r.passcodeEnabled,
        }),
      };
    } catch (err) {
      console.error('Display patch error:', err);
      return {
        statusCode: 500,
        headers: AUTH_JSON_HEADERS,
        body: JSON.stringify({
          error: 'Failed to update',
          ...(debug ? { debug: { method: 'PATCH' } } : {}),
        }),
      };
    }
  }

  // DELETE /api/displays?id=<id> — delete a display
  if (event.httpMethod === 'DELETE') {
    try {
      const id = event.queryStringParameters?.id;
      if (!id) return errorResponse(400, 'Missing id', AUTH_JSON_HEADERS);

      const countRows = await db
        .select({ cnt: sql<number>`count(*)` })
        .from(displays)
        .innerJoin(users, eq(users.id, displays.userId))
        .where(eq(users.googleId, googleId));

      const cnt = Number(countRows[0]?.cnt ?? 0);
      if (cnt <= 1) {
        return {
          statusCode: 409,
          headers: AUTH_JSON_HEADERS,
          body: JSON.stringify({
            error: 'Cannot delete last display',
            ...(debug ? { debug: { ownedDisplayCount: cnt } } : {}),
          }),
        };
      }

      await db
        .delete(displays)
        .where(
          sql`${displays.id} = ${id}::uuid AND ${displays.userId} IN (SELECT id FROM users WHERE google_id = ${googleId})`
        );

      return jsonResponse(200, { ok: true }, AUTH_JSON_HEADERS);
    } catch (err) {
      console.error('Display delete error:', err);
      return {
        statusCode: 500,
        headers: AUTH_JSON_HEADERS,
        body: JSON.stringify({
          error: 'Failed to delete',
          ...(debug ? { debug: { method: 'DELETE' } } : {}),
        }),
      };
    }
  }

  return errorResponse(405, 'Method not allowed', AUTH_JSON_HEADERS);
};
