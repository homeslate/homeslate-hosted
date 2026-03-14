import type { Handler } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import {
  getDb,
  users,
  displays,
  displayPairing,
} from '../../src/db';
import { AUTH_JSON_HEADERS, errorResponse, optionsResponse } from './_shared/http';
import { requireGoogleId } from './_shared/googleAuth';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(AUTH_JSON_HEADERS);
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed', AUTH_JSON_HEADERS);
  }

  const db = getDb();
  let googleId: string;
  try {
    googleId = await requireGoogleId(event.headers['authorization']);
  } catch {
    return errorResponse(401, 'Unauthorized', AUTH_JSON_HEADERS);
  }

  const body = JSON.parse(event.body ?? '{}') as { code?: string };
  const code = body.code?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code || code.length !== 6) {
    return errorResponse(400, 'Invalid or missing code', AUTH_JSON_HEADERS);
  }

  try {
    const [pairRow] = await db
      .select()
      .from(displayPairing)
      .where(eq(displayPairing.code, code));

    if (!pairRow) {
      return errorResponse(404, 'Code not found', AUTH_JSON_HEADERS);
    }
    if (pairRow.displayId) {
      return errorResponse(409, 'Code already claimed', AUTH_JSON_HEADERS);
    }

    const expiresAt = typeof pairRow.expiresAt === 'string' ? new Date(pairRow.expiresAt) : pairRow.expiresAt;
    if (expiresAt.getTime() < Date.now()) {
      return errorResponse(410, 'Code expired', AUTH_JSON_HEADERS);
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.googleId, googleId));

    if (!user) {
      return errorResponse(401, 'User not found', AUTH_JSON_HEADERS);
    }

    const [created] = await db
      .insert(displays)
      .values({ userId: user.id, name: 'Kitchen Display' })
      .returning({
        id: displays.id,
        displayId: displays.displayId,
        name: displays.name,
        createdAt: displays.createdAt,
      });

    if (!created) {
      return errorResponse(500, 'Failed to create display', AUTH_JSON_HEADERS);
    }

    const publicDisplayId = created.displayId;
    const updated = await db
      .update(displayPairing)
      .set({ displayId: publicDisplayId })
      .where(eq(displayPairing.code, code))
      .returning({ code: displayPairing.code, displayId: displayPairing.displayId });

    if (!updated.length) {
      console.error('Claim: pairing row update affected 0 rows', { code });
      return errorResponse(500, 'Failed to link device', AUTH_JSON_HEADERS);
    }

    return {
      statusCode: 200,
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        id: created.id,
        display_id: publicDisplayId,
        name: created.name,
        created_at: created.createdAt,
      }),
    };
  } catch (err) {
    console.error('Claim error:', err);
    return errorResponse(500, 'Server error', AUTH_JSON_HEADERS);
  }
};
