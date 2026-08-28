import type { Handler } from '@netlify/functions';
import { eq, sql } from 'drizzle-orm';
import { getDb, displays, users, displayCollaborators } from '../../src/db';
import {
  classifyRefreshFailure,
  describeTokenRow,
  errorMessage,
  isAccessTokenUnexpired,
  normalizeTokenRow,
  summarizeTokenCandidates,
  type TokenCandidate,
} from '../../src/services/displayCalendarAuth';
import { exchangeRefreshToken } from './_shared/googleTokens';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const LOG_PREFIX = '[display-calendar]';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

async function exchangeRefreshForAccess(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const data = await exchangeRefreshToken(refreshToken);
  return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status: string;
  colorId?: string;
  htmlLink?: string;
  description?: string;
  location?: string;
}

interface ParsedEvent {
  id: string;
  calendarId: string;
  calendarName?: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  htmlLink?: string;
}

const EVENT_COLORS: Record<string, string> = {
  '1': '#7986CB', '2': '#33B679', '3': '#8E24AA', '4': '#E67C73', '5': '#F6BF26',
  '6': '#F4511E', '7': '#039BE5', '8': '#3F51B5', '9': '#0F9D58', '10': '#D50000', '11': '#616161',
};

function parseEvent(
  event: GoogleCalendarEvent,
  calendarId: string,
  calendarColor: string,
  calendarName?: string
): ParsedEvent | null {
  const startStr = event.start?.dateTime ?? event.start?.date;
  const endStr = event.end?.dateTime ?? event.end?.date;
  if (!startStr || !endStr) return null;
  const allDay = !!event.start?.date && !event.start?.dateTime;
  const color = event.colorId ? (EVENT_COLORS[event.colorId] ?? calendarColor) : calendarColor;
  return {
    id: event.id,
    calendarId,
    calendarName,
    title: event.summary ?? '(No title)',
    description: event.description,
    location: event.location,
    start: startStr,
    end: endStr,
    allDay,
    color,
    htmlLink: event.htmlLink,
  };
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

    let token: string | null = null;
    let chosenSource: TokenCandidate['source'] | null = null;
    const refreshFailures: Array<{ source: TokenCandidate['source']; reason: string; error: string }> = [];

    for (const candidate of tokenCandidates) {
      if (candidate.refresh_token) {
        try {
          const exchanged = await exchangeRefreshForAccess(candidate.refresh_token);
          token = exchanged.access_token;
          chosenSource = candidate.source;
          const expiresAt = new Date(Date.now() + exchanged.expires_in * 1000).toISOString();
          await db.execute(sql`
            UPDATE users
            SET access_token = ${exchanged.access_token},
                access_token_expires_at = ${expiresAt}::timestamptz
            WHERE id = ${candidate.user_id}::uuid
          `);
          console.info(`${LOG_PREFIX} refresh succeeded`, {
            displayId,
            source: candidate.source,
            expiresIn: exchanged.expires_in,
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
        error: 'A display owner or linked collaborator needs to sign in from the management app to refresh calendar access',
        reason,
        details,
      });
    }

    console.info(`${LOG_PREFIX} token selected`, { displayId, source: chosenSource });

    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const timeMax = new Date(timeMin.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const calendarListRes = await fetch(`${GOOGLE_API_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!calendarListRes.ok) {
      const googleBody = (await calendarListRes.text()).slice(0, 300);
      console.error(`${LOG_PREFIX} calendar list failed`, {
        displayId,
        status: calendarListRes.status,
        googleBody,
      });
      return json(502, {
        error: 'Failed to fetch calendar list',
        reason: 'calendar_list_failed',
        details: { status: calendarListRes.status },
      });
    }
    const calendarListData = (await calendarListRes.json()) as { items?: Array<{ id: string; summary?: string; backgroundColor?: string }> };
    const calendars = calendarListData.items ?? [];
    const calendarMap = new Map(calendars.map((c) => [c.id, c]));

    const allEvents: ParsedEvent[] = [];
    const calendarFetchFailures: Array<{ calendarId: string; status: number }> = [];
    for (const calendarId of calendarIds) {
      const cal = calendarMap.get(calendarId);
      const color = cal?.backgroundColor ?? '#4285f4';
      const name = cal?.summary;

      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: '100',
        singleEvents: 'true',
        orderBy: 'startTime',
      });
      const res = await fetch(
        `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        calendarFetchFailures.push({ calendarId, status: res.status });
        continue;
      }
      const data = (await res.json()) as { items?: GoogleCalendarEvent[] };
      const items = data.items ?? [];
      for (const ev of items) {
        if (ev.status === 'cancelled') continue;
        const parsed = parseEvent(ev, calendarId, color, name);
        if (parsed) allEvents.push(parsed);
      }
    }

    if (calendarFetchFailures.length > 0) {
      console.warn(`${LOG_PREFIX} some calendars failed`, {
        displayId,
        failures: calendarFetchFailures,
        googleCalendarCount: calendars.length,
      });
    }

    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const calendarsForClient = calendarIds.map((id) => {
      const c = calendarMap.get(id);
      return { id, summary: c?.summary ?? id, backgroundColor: c?.backgroundColor };
    });

    console.info(`${LOG_PREFIX} success`, {
      displayId,
      source: chosenSource,
      eventCount: allEvents.length,
      calendarCount: calendarsForClient.length,
      failedCalendars: calendarFetchFailures.length,
    });

    return json(200, { events: allEvents, calendars: calendarsForClient });
  } catch (err) {
    console.error(`${LOG_PREFIX} server error`, { displayId, error: errorMessage(err) });
    return json(500, { error: 'Server error', reason: 'server_error' });
  }
};
