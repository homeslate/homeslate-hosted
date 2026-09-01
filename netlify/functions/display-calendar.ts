import type { Handler } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import {
  isGoogleAuthError,
  listCalendarsWithAccessToken,
  listEventsWithAccessToken,
  type CalendarEvent,
  type CalendarListItem,
} from '@homeslate/google';
import { getDb, displays, users, displayCollaborators } from '../../src/db';
import {
  classifyRefreshFailure,
  describeTokenRow,
  errorMessage,
  isAccessTokenUnexpired,
  isFatalGoogleAuthFailure,
  normalizeTokenRow,
  summarizeTokenCandidates,
  type TokenCandidate,
} from '../../src/services/displayCalendarAuth';
import { DISPLAY_GOOGLE_RECONNECT_MESSAGE } from '../../src/widgets/googleCalendarError';
import { createHostedGoogleClient } from './_shared/googleClient';
import { createNeonTokenStore } from './_shared/neonTokenStore';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const LOG_PREFIX = '[display-calendar]';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const displayId = event.queryStringParameters?.displayId;
  const calendarIdsParam = event.queryStringParameters?.calendarIds;
  const daysAhead = Math.min(90, Math.max(1, parseInt(event.queryStringParameters?.daysAhead ?? '30', 10) || 30));

  if (!displayId || !calendarIdsParam) {
    console.warn(`${LOG_PREFIX} missing query params`, {
      hasDisplayId: !!displayId,
      hasCalendarIds: !!calendarIdsParam,
    });
    return json(400, { error: 'Missing displayId or calendarIds', reason: 'missing_params' });
  }

  const calendarIds = calendarIdsParam.split(',').map((id) => id.trim()).filter(Boolean);
  if (calendarIds.length === 0) {
    return json(200, { events: [], calendars: [] });
  }

  console.info(`${LOG_PREFIX} request`, {
    displayId,
    calendarCount: calendarIds.length,
    daysAhead,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  });

  const db = getDb();

  try {
    const ownerSelect = await db
      .select({
        userId: users.id,
        refreshToken: users.refreshToken,
        accessToken: users.accessToken,
        accessTokenExpiresAt: users.accessTokenExpiresAt,
      })
      .from(displays)
      .innerJoin(users, eq(users.id, displays.userId))
      .where(eq(displays.displayId, displayId))
      .limit(1);

    const ownerRow = ownerSelect[0] ? normalizeTokenRow(ownerSelect[0] as Record<string, unknown>) : null;
    if (ownerSelect[0] && !ownerRow) {
      console.warn(`${LOG_PREFIX} owner row did not normalize`, {
        displayId,
        keys: Object.keys(ownerSelect[0]),
      });
    }

    let collaboratorSelect: Array<Record<string, unknown>> = [];
    try {
      collaboratorSelect = (await db
        .select({
          userId: users.id,
          refreshToken: users.refreshToken,
          accessToken: users.accessToken,
          accessTokenExpiresAt: users.accessTokenExpiresAt,
        })
        .from(displays)
        .innerJoin(displayCollaborators, eq(displayCollaborators.displayId, displays.id))
        .innerJoin(users, eq(users.id, displayCollaborators.userId))
        .where(eq(displays.displayId, displayId))) as Array<Record<string, unknown>>;
    } catch (err) {
      console.warn(`${LOG_PREFIX} collaborator lookup skipped`, { error: errorMessage(err) });
    }

    const tokenCandidates: TokenCandidate[] = [
      ...(ownerRow ? [{ ...ownerRow, source: 'owner' as const }] : []),
      ...collaboratorSelect.flatMap((row) => {
        const normalized = normalizeTokenRow(row);
        return normalized ? [{ ...normalized, source: 'collaborator' as const }] : [];
      }),
    ];

    const tokenSummary = summarizeTokenCandidates(tokenCandidates);
    console.info(`${LOG_PREFIX} token candidates`, {
      displayId,
      ...tokenSummary,
      owner: ownerRow ? describeTokenRow(ownerRow) : null,
    });

    const refreshFailures: Array<{ source: TokenCandidate['source']; reason: string; error: string }> = [];
    const tokenStore = createNeonTokenStore(db);
    let client: ReturnType<typeof createHostedGoogleClient> | null = null;
    try {
      client = createHostedGoogleClient(tokenStore);
    } catch (err) {
      console.warn(`${LOG_PREFIX} google client unavailable`, { error: errorMessage(err) });
      refreshFailures.push({
        source: 'owner',
        reason: classifyRefreshFailure(err),
        error: errorMessage(err),
      });
    }

    let token: string | null = null;
    let chosenSource: TokenCandidate['source'] | null = null;

    for (const candidate of tokenCandidates) {
      if (client) {
        try {
          token = await client.getAccessToken(candidate.user_id);
          chosenSource = candidate.source;
          console.info(`${LOG_PREFIX} token selected via client`, {
            displayId,
            source: candidate.source,
          });
          break;
        } catch (err) {
          const reason = classifyRefreshFailure(err);
          const error = errorMessage(err);
          console.error(`${LOG_PREFIX} refresh failed`, {
            displayId,
            source: candidate.source,
            reason,
            error,
            googleAuth: isGoogleAuthError(err) ? err.code : undefined,
          });
          refreshFailures.push({ source: candidate.source, reason, error });
        }
      }

      if (!token && candidate.access_token && isAccessTokenUnexpired(candidate.access_token_expires_at, Date.now())) {
        token = candidate.access_token;
        chosenSource = candidate.source;
        console.info(`${LOG_PREFIX} using unexpired access token fallback`, {
          displayId,
          source: candidate.source,
        });
        break;
      }
    }

    if (!token) {
      const reason = refreshFailures[0]?.reason
        ?? (tokenSummary.ownerCandidates === 0 ? 'display_not_found' : 'no_usable_token');
      const details = {
        ...tokenSummary,
        refreshFailures,
      };
      console.warn(`${LOG_PREFIX} no usable token`, { displayId, reason, ...details });
      return json(404, {
        error: isFatalGoogleAuthFailure(reason)
          ? DISPLAY_GOOGLE_RECONNECT_MESSAGE
          : 'A display owner or linked collaborator needs to sign in from the management app to refresh calendar access',
        reason,
        details,
      });
    }

    console.info(`${LOG_PREFIX} token selected`, { displayId, source: chosenSource });

    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const timeMax = new Date(timeMin.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    let calendars: CalendarListItem[];
    try {
      calendars = await listCalendarsWithAccessToken(token);
    } catch (err) {
      console.error(`${LOG_PREFIX} calendar list failed`, {
        displayId,
        error: errorMessage(err),
      });
      return json(502, {
        error: 'Failed to fetch calendar list',
        reason: 'calendar_list_failed',
      });
    }

    const allEvents: CalendarEvent[] = await listEventsWithAccessToken(token, {
      calendarIds,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      calendarList: calendars,
    });

    const calendarMap = new Map(calendars.map((calendar) => [calendar.id, calendar]));
    const calendarsForClient = calendarIds.map((id) => {
      const c = calendarMap.get(id);
      return { id, summary: c?.summary ?? id, backgroundColor: c?.backgroundColor };
    });

    console.info(`${LOG_PREFIX} success`, {
      displayId,
      source: chosenSource,
      eventCount: allEvents.length,
      calendarCount: calendarsForClient.length,
    });

    return json(200, { events: allEvents, calendars: calendarsForClient });
  } catch (err) {
    console.error(`${LOG_PREFIX} server error`, { displayId, error: errorMessage(err) });
    return json(500, { error: 'Server error', reason: 'server_error' });
  }
};
