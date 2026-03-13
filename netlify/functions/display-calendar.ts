import type { Handler } from '@netlify/functions';
import { sql } from 'drizzle-orm';
import { getDb } from '../../src/db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';

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

    const rows = await db.execute(sql`
      SELECT
        u.refresh_token AS refresh_token,
        u.access_token AS access_token,
        u.access_token_expires_at AS access_token_expires_at
      FROM displays d
      INNER JOIN users u ON u.id = d.user_id
      WHERE d.display_id = ${displayId}::uuid
      LIMIT 1
    `);
    const row = rows[0] as
      | { refresh_token: string | null; access_token: string | null; access_token_expires_at: string | null }
      | undefined;

    let token: string | null = null;
    if (row?.refresh_token) {
      token = await getAccessToken(row.refresh_token);
    } else if (row?.access_token && row.access_token_expires_at) {
      const expiresMs = new Date(row.access_token_expires_at).getTime();
      // Keep a small safety margin.
      if (expiresMs > Date.now() + 60_000) {
        token = row.access_token;
      }
    }

    if (!token) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ error: 'Display owner needs to sign in from the management app to refresh calendar access' }),
      };
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
