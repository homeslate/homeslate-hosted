import type { Handler } from '@netlify/functions';
import { sql } from 'drizzle-orm';
import { getDb } from '../../src/db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';

interface TokenRow {
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
}

interface TokenCandidate extends TokenRow {
  source: 'owner' | 'collaborator';
}

function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (
    result &&
    typeof result === 'object' &&
    'rows' in result &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function isDebugEnabled(event: Parameters<Handler>[0]): boolean {
  const queryDebug = event.queryStringParameters?.debug === '1';
  const envDebug = process.env.DEBUG_DISPLAY_CALENDAR === '1';
  return queryDebug || envDebug;
}

function toCandidate(row: TokenRow | undefined, source: TokenCandidate['source']): TokenCandidate[] {
  if (!row) return [];
  return [{ ...row, source }];
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing Google OAuth credentials');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh token');
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
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
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const displayId = event.queryStringParameters?.displayId;
  const calendarIdsParam = event.queryStringParameters?.calendarIds;
  const debug = isDebugEnabled(event);
  const daysAhead = Math.min(90, Math.max(1, parseInt(event.queryStringParameters?.daysAhead ?? '30', 10) || 30));

  if (!displayId || !calendarIdsParam) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ error: 'Missing displayId or calendarIds' }),
    };
  }

  const calendarIds = calendarIdsParam.split(',').map((id) => id.trim()).filter(Boolean);
  if (calendarIds.length === 0) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ events: [], calendars: [] }),
    };
  }

  const db = getDb();

  try {
    // Idempotent migration for local/dev databases that don't yet have
    // access-token fallback columns on users.
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token TEXT`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT`);
    } catch {
      // Ignore migration race/unsupported DDL errors and continue.
    }

    const ownerResult = await db.execute(sql`
      SELECT
        u.refresh_token AS refresh_token,
        u.access_token AS access_token,
        u.access_token_expires_at AS access_token_expires_at
      FROM displays d
      INNER JOIN users u ON u.id = d.user_id
      WHERE d.display_id = ${displayId}::uuid
      LIMIT 1
    `);
    const ownerRows = extractRows<TokenRow>(ownerResult);
    const ownerRow = ownerRows[0];

    let collaboratorRows: TokenRow[] = [];

    try {
      const collabResult = await db.execute(sql`
        SELECT
          u.refresh_token AS refresh_token,
          u.access_token AS access_token,
          u.access_token_expires_at AS access_token_expires_at
        FROM displays d
        INNER JOIN display_collaborators dc ON dc.display_id = d.id
        INNER JOIN users u ON u.id = dc.user_id
        WHERE d.display_id = ${displayId}::uuid
      `);
      collaboratorRows = extractRows<TokenRow>(collabResult);
    } catch {
      // Older databases may not have sharing tables yet. Owner token path still works.
    }

    const tokenCandidates: TokenCandidate[] = [
      ...toCandidate(ownerRow, 'owner'),
      ...collaboratorRows.map((row) => ({ ...row, source: 'collaborator' as const })),
    ];

    let token: string | null = null;
    let chosenSource: TokenCandidate['source'] | null = null;
    const refreshFailures: Array<TokenCandidate['source']> = [];

    for (const candidate of tokenCandidates) {
      if (candidate.refresh_token) {
        try {
          token = await getAccessToken(candidate.refresh_token);
          chosenSource = candidate.source;
          break;
        } catch {
          refreshFailures.push(candidate.source);
          // Try next linked user token.
        }
      }

      if (!token && candidate.access_token && candidate.access_token_expires_at) {
        const expiresMs = new Date(candidate.access_token_expires_at).getTime();
        // Keep a small safety margin.
        if (expiresMs > Date.now() + 60_000) {
          token = candidate.access_token;
          chosenSource = candidate.source;
          break;
        }
      }
    }

    if (!token) {
      if (debug) {
        console.info('display-calendar token debug', {
          displayId,
          ownerCandidates: ownerRow ? 1 : 0,
          collaboratorCandidates: collaboratorRows.length,
          refreshFailures,
          hasAnyRefreshToken: tokenCandidates.some((c) => !!c.refresh_token),
          hasAnyAccessToken: tokenCandidates.some((c) => !!c.access_token),
        });
      }
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({
          error: 'A display owner or linked collaborator needs to sign in from the management app to refresh calendar access',
          ...(debug
            ? {
                debug: {
                  ownerCandidates: ownerRow ? 1 : 0,
                  collaboratorCandidates: collaboratorRows.length,
                  refreshFailures,
                  hasAnyRefreshToken: tokenCandidates.some((c) => !!c.refresh_token),
                  hasAnyAccessToken: tokenCandidates.some((c) => !!c.access_token),
                },
              }
            : {}),
        }),
      };
    }

    if (debug) {
      console.info('display-calendar token selected', {
        displayId,
        source: chosenSource,
      });
    }

    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const timeMax = new Date(timeMin.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const calendarListRes = await fetch(`${GOOGLE_API_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!calendarListRes.ok) {
      return {
        statusCode: 502,
        headers: CORS,
        body: JSON.stringify({ error: 'Failed to fetch calendar list' }),
      };
    }
    const calendarListData = (await calendarListRes.json()) as { items?: Array<{ id: string; summary?: string; backgroundColor?: string }> };
    const calendars = calendarListData.items ?? [];
    const calendarMap = new Map(calendars.map((c) => [c.id, c]));

    const allEvents: ParsedEvent[] = [];
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
      if (!res.ok) continue;
      const data = (await res.json()) as { items?: GoogleCalendarEvent[] };
      const items = data.items ?? [];
      for (const ev of items) {
        if (ev.status === 'cancelled') continue;
        const parsed = parseEvent(ev, calendarId, color, name);
        if (parsed) allEvents.push(parsed);
      }
    }

    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const calendarsForClient = calendarIds.map((id) => {
      const c = calendarMap.get(id);
      return { id, summary: c?.summary ?? id, backgroundColor: c?.backgroundColor };
    });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ events: allEvents, calendars: calendarsForClient }),
    };
  } catch (err) {
    console.error('Display calendar error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Server error' }),
    };
  }
};
