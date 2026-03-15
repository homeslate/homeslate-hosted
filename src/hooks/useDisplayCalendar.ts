import { useState, useEffect, useCallback } from 'react';
import type { GoogleCalendar, ParsedCalendarEvent, CalendarEventInput } from '../services/googleCalendar';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface UseDisplayCalendarOptions {
  displayId: string | null;
  selectedCalendarIds: string[];
  daysAhead?: number;
}

interface UseDisplayCalendarResult {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  calendars: GoogleCalendar[];
  events: ParsedCalendarEvent[];
  refresh: () => void;
  addEvent: (calendarId: string, event: CalendarEventInput) => Promise<void>;
  editEvent: (calendarId: string, eventId: string, event: CalendarEventInput) => Promise<void>;
  removeEvent: (calendarId: string, eventId: string) => Promise<void>;
}

const EMPTY_RESULT: UseDisplayCalendarResult = {
  isAuthenticated: false,
  isLoading: false,
  error: null,
  calendars: [],
  events: [],
  refresh: () => {},
  addEvent: async () => {},
  editEvent: async () => {},
  removeEvent: async () => {},
};

function parseEventFromServer(ev: { start: string; end: string; [k: string]: unknown }): ParsedCalendarEvent {
  return {
    id: ev.id as string,
    calendarId: ev.calendarId as string,
    calendarName: ev.calendarName as string | undefined,
    title: (ev.title as string) ?? '(No title)',
    description: ev.description as string | undefined,
    location: ev.location as string | undefined,
    start: new Date(ev.start as string),
    end: new Date(ev.end as string),
    allDay: !!ev.allDay,
    color: (ev.color as string) ?? '#4285f4',
    htmlLink: ev.htmlLink as string | undefined,
  };
}

export function useDisplayCalendar({
  displayId,
  selectedCalendarIds,
  daysAhead = 30,
}: UseDisplayCalendarOptions): UseDisplayCalendarResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [events, setEvents] = useState<ParsedCalendarEvent[]>([]);
  const selectedCalendarIdsKey = selectedCalendarIds.join(',');

  const fetchData = useCallback(async () => {
    if (!displayId || selectedCalendarIdsKey.length === 0) {
      setCalendars([]);
      setEvents([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        displayId,
        calendarIds: selectedCalendarIdsKey,
        daysAhead: String(daysAhead),
      });
      const res = await fetch(`/api/display-calendar?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load calendar');
        setCalendars([]);
        setEvents([]);
        return;
      }
      const calList = (data.calendars ?? []).map((c: { id: string; summary?: string; backgroundColor?: string }) => ({
        id: c.id,
        summary: c.summary ?? c.id,
        backgroundColor: c.backgroundColor,
      }));
      setCalendars(calList);
      setEvents((data.events ?? []).map(parseEventFromServer));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
      setCalendars([]);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [displayId, selectedCalendarIdsKey, daysAhead]);

  useEffect(() => {
    if (!displayId) {
      setIsLoading(false);
      setError(null);
      setCalendars([]);
      setEvents([]);
      return;
    }
    fetchData();
  }, [displayId, fetchData]);

  useEffect(() => {
    if (!displayId || selectedCalendarIdsKey.length === 0) return;
    const t = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [displayId, selectedCalendarIdsKey, fetchData]);

  if (!displayId) return EMPTY_RESULT;

  return {
    isAuthenticated: true,
    isLoading,
    error,
    calendars,
    events,
    refresh: fetchData,
    addEvent: async () => {}, // display-only: no write
    editEvent: async () => {},
    removeEvent: async () => {},
  };
}
