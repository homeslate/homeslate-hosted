import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchCalendarList,
  fetchAllCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type GoogleCalendar,
  type ParsedCalendarEvent,
  type CalendarEventInput,
} from '../services/googleCalendar';

interface UseGoogleCalendarOptions {
  // clientId is kept in the type for config backward-compatibility but is no
  // longer used — the shared AuthContext token is used instead.
  clientId?: string;
  selectedCalendarIds: string[];
  daysAhead?: number;
  refreshInterval?: number;
}

interface UseGoogleCalendarResult {
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

export function useGoogleCalendar({
  selectedCalendarIds,
  daysAhead = 30,
  refreshInterval = 5 * 60 * 1000,
}: UseGoogleCalendarOptions): UseGoogleCalendarResult {
  const { accessToken, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [events, setEvents] = useState<ParsedCalendarEvent[]>([]);

  const fetchCalendars = useCallback(async () => {
    if (!accessToken) return;
    try {
      setCalendars(await fetchCalendarList(accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendars');
    }
  }, [accessToken]);

  const fetchEvents = useCallback(async () => {
    if (!accessToken || selectedCalendarIds.length === 0) {
      setEvents([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setEvents(await fetchAllCalendarEvents(accessToken, selectedCalendarIds, daysAhead));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedCalendarIds, daysAhead]);

  useEffect(() => {
    if (isAuthenticated) fetchCalendars();
  }, [isAuthenticated, fetchCalendars]);

  useEffect(() => {
    if (isAuthenticated && selectedCalendarIds.length > 0) fetchEvents();
  }, [isAuthenticated, selectedCalendarIds, fetchEvents]);

  useEffect(() => {
    if (!isAuthenticated || selectedCalendarIds.length === 0) return;
    const interval = setInterval(fetchEvents, refreshInterval);
    return () => clearInterval(interval);
  }, [isAuthenticated, selectedCalendarIds, fetchEvents, refreshInterval]);

  const refresh = useCallback(() => {
    fetchCalendars();
    fetchEvents();
  }, [fetchCalendars, fetchEvents]);

  const addEvent = useCallback(
    async (calendarId: string, event: CalendarEventInput) => {
      if (!accessToken) throw new Error('Not authenticated');
      await createCalendarEvent(accessToken, calendarId, event);
      void fetchEvents();
    },
    [accessToken, fetchEvents]
  );

  const editEvent = useCallback(
    async (calendarId: string, eventId: string, event: CalendarEventInput) => {
      if (!accessToken) throw new Error('Not authenticated');
      await updateCalendarEvent(accessToken, calendarId, eventId, event);
      void fetchEvents();
    },
    [accessToken, fetchEvents]
  );

  const removeEvent = useCallback(
    async (calendarId: string, eventId: string) => {
      if (!accessToken) throw new Error('Not authenticated');
      await deleteCalendarEvent(accessToken, calendarId, eventId);
      void fetchEvents();
    },
    [accessToken, fetchEvents]
  );

  return {
    isAuthenticated,
    isLoading,
    error,
    calendars,
    events,
    refresh,
    addEvent,
    editEvent,
    removeEvent,
  };
}
