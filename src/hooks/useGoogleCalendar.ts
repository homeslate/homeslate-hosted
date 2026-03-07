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
import {
  useCalendarCacheStore,
  calendarCacheKey,
} from '../store/calendarCacheStore';

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
  const { getEntry, setEntry } = useCalendarCacheStore();
  const cacheKey = calendarCacheKey(selectedCalendarIds, daysAhead);

  // Seed local state from cache immediately so there's no loading flash on remount.
  const cached = getEntry(cacheKey);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>(cached?.calendars ?? []);
  const [events, setEvents] = useState<ParsedCalendarEvent[]>(cached?.events ?? []);

  const fetchCalendars = useCallback(async () => {
    if (!accessToken) return;
    try {
      const result = await fetchCalendarList(accessToken);
      setCalendars(result);
      // Update the calendars portion of the cache entry if one exists.
      const existing = getEntry(cacheKey);
      if (existing) {
        setEntry(cacheKey, { ...existing, calendars: result });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendars');
    }
  }, [accessToken, cacheKey, getEntry, setEntry]);

  const fetchEvents = useCallback(async (force = false) => {
    if (!accessToken || selectedCalendarIds.length === 0) {
      setEvents([]);
      return;
    }
    // Skip the network call if the cache is still fresh and this isn't a forced refresh.
    if (!force) {
      const existing = getEntry(cacheKey);
      if (existing && Date.now() - existing.fetchedAt < refreshInterval) {
        setCalendars(existing.calendars);
        setEvents(existing.events);
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(true);
    setError(null);
    try {
      const [calendarList, eventList] = await Promise.all([
        fetchCalendarList(accessToken),
        fetchAllCalendarEvents(accessToken, selectedCalendarIds, daysAhead),
      ]);
      setCalendars(calendarList);
      setEvents(eventList);
      setEntry(cacheKey, { calendars: calendarList, events: eventList, fetchedAt: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedCalendarIds, daysAhead, cacheKey, refreshInterval, getEntry, setEntry]);

  useEffect(() => {
    if (isAuthenticated && selectedCalendarIds.length > 0) void fetchEvents();
  }, [isAuthenticated, selectedCalendarIds, fetchEvents]);

  useEffect(() => {
    if (!isAuthenticated || selectedCalendarIds.length === 0) return;
    const interval = setInterval(() => void fetchEvents(true), refreshInterval);
    return () => clearInterval(interval);
  }, [isAuthenticated, selectedCalendarIds, fetchEvents, refreshInterval]);

  const refresh = useCallback(() => {
    void fetchCalendars();
    void fetchEvents(true);
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
