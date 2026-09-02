import type { CalendarEvent, CalendarListItem } from './types';

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const DEFAULT_CALENDAR_COLOR = '#4285f4';

const EVENT_COLORS: Record<string, string> = {
  '1': '#7986CB',
  '2': '#33B679',
  '3': '#8E24AA',
  '4': '#E67C73',
  '5': '#F6BF26',
  '6': '#F4511E',
  '7': '#039BE5',
  '8': '#3F51B5',
  '9': '#0F9D58',
  '10': '#D50000',
  '11': '#616161',
};

type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  colorId?: string;
  htmlLink?: string;
  description?: string;
  location?: string;
};

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

function parseEvent(
  event: GoogleCalendarEvent,
  calendarId: string,
  calendarColor: string,
  calendarName?: string
): CalendarEvent | null {
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!start || !end) return null;
  const allDay = Boolean(event.start?.date) && !event.start?.dateTime;
  const color = event.colorId ? (EVENT_COLORS[event.colorId] ?? calendarColor) : calendarColor;
  return {
    id: event.id,
    calendarId,
    calendarName,
    title: event.summary ?? '(No title)',
    description: event.description,
    location: event.location,
    start,
    end,
    allDay,
    color,
    htmlLink: event.htmlLink,
  };
}

export async function listCalendarsWithAccessToken(
  accessToken: string
): Promise<CalendarListItem[]> {
  const res = await fetch(`${GOOGLE_API_BASE}/users/me/calendarList`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch calendar list: ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      backgroundColor?: string;
      description?: string;
      foregroundColor?: string;
      primary?: boolean;
      selected?: boolean;
    }>;
  };
  return (data.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? item.id,
    backgroundColor: item.backgroundColor,
    description: item.description,
    foregroundColor: item.foregroundColor,
    primary: item.primary,
    selected: item.selected,
  }));
}

export async function listEventsWithAccessToken(
  accessToken: string,
  params: {
    calendarIds: string[];
    timeMin: string;
    timeMax: string;
    calendarList?: CalendarListItem[];
    maxResults?: number;
  }
): Promise<CalendarEvent[]> {
  const calendars =
    params.calendarList ?? (await listCalendarsWithAccessToken(accessToken));
  const calendarMap = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const maxResults = String(params.maxResults ?? 100);
  const allEvents: CalendarEvent[] = [];

  for (const calendarId of params.calendarIds) {
    const cal = calendarMap.get(calendarId);
    const color = cal?.backgroundColor ?? DEFAULT_CALENDAR_COLOR;
    const query = new URLSearchParams({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      maxResults,
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    const res = await fetch(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
      { headers: authHeaders(accessToken) }
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { items?: GoogleCalendarEvent[] };
    for (const event of data.items ?? []) {
      if (event.status === 'cancelled') continue;
      const parsed = parseEvent(event, calendarId, color, cal?.summary);
      if (parsed) allEvents.push(parsed);
    }
  }

  return allEvents.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}
