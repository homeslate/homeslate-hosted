import { useState, useEffect, useCallback } from 'react';
import { useGoogleRuntime } from '../googleRuntime';
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
import { getNextPollDelay } from './polling';

interface UseGoogleCalendarOptions {
  // clientId is kept in the type for config backward-compatibility but is no
  // longer used — the shared AuthContext token is used instead.
  clientId?: string;
  selectedCalendarIds: string[];
  daysAhead?: number;
  refreshInterval?: number;
  enabled?: boolean;
}

interface UseGoogleCalendarResult {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  calendars: GoogleCalendar[];
  events: ParsedCalendarEvent[];
  lastUpdated: number | null;
  refresh: () => void;
  addEvent: (calendarId: string, event: CalendarEventInput) => Promise<void>;
  editEvent: (calendarId: string, eventId: string, event: CalendarEventInput) => Promise<void>;
  removeEvent: (calendarId: string, eventId: string) => Promise<void>;
}

const TOKEN_EXPIRED_MSG = 'Token expired. Please sign in again.';

export function useGoogleCalendar({
  selectedCalendarIds,
  daysAhead = 30,
  refreshInterval = 5 * 60 * 1000,
  enabled = true,
}: UseGoogleCalendarOptions): UseGoogleCalendarResult {
  const { accessToken, isAuthenticated, refreshAccessToken } = useGoogleRuntime();
  const { getEntry, setEntry } = useCalendarCacheStore();
  const cacheKey = calendarCacheKey(selectedCalendarIds, daysAhead);

  // Seed local state from cache immediately so there's no loading flash on remount.
  const cached = getEntry(cacheKey);
  const [isLoading, setIsLoading] = useState(enabled && !cached);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>(cached?.calendars ?? []);
  const [events, setEvents] = useState<ParsedCalendarEvent[]>(cached?.events ?? []);
  const [lastUpdated, setLastUpdated] = useState<number | null>(cached?.fetchedAt ?? null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const fetchCalendars = useCallback(async () => {
    if (!enabled) return;
    if (!accessToken) return;
    const doFetch = async (token: string) => {
      const result = await fetchCalendarList(token);
      setCalendars(result);
      const existing = getEntry(cacheKey);
      if (existing) {
        setEntry(cacheKey, { ...existing, calendars: result });
      }
    };
    try {
      await doFetch(accessToken);
    } catch (err) {
      if (err instanceof Error && err.message === TOKEN_EXPIRED_MSG) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          try {
            await doFetch(newToken);
            setError(null);
            return;
          } catch {
            /* fall through to set error */
          }
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch calendars');
    }
  }, [enabled, accessToken, cacheKey, getEntry, setEntry, refreshAccessToken]);

  const fetchEvents = useCallback(async (force = false) => {
    if (!enabled) return;
    if (!accessToken || selectedCalendarIds.length === 0) {
      setEvents([]);
      setLastUpdated(null);
      setConsecutiveFailures(0);
      return;
    }
    if (!force) {
      const existing = getEntry(cacheKey);
      if (existing && Date.now() - existing.fetchedAt < refreshInterval) {
        setCalendars(existing.calendars);
        setEvents(existing.events);
        setLastUpdated(existing.fetchedAt);
        setIsLoading(false);
        return;
      }
    }
    setIsLoading(true);
    setError(null);
    const doFetch = async (token: string) => {
      const [calendarList, eventList] = await Promise.all([
        fetchCalendarList(token),
        fetchAllCalendarEvents(token, selectedCalendarIds, daysAhead),
      ]);
      setCalendars(calendarList);
      setEvents(eventList);
      const fetchedAt = Date.now();
      setEntry(cacheKey, { calendars: calendarList, events: eventList, fetchedAt });
      setLastUpdated(fetchedAt);
      setConsecutiveFailures(0);
    };
    try {
      await doFetch(accessToken);
    } catch (err) {
      if (err instanceof Error && err.message === TOKEN_EXPIRED_MSG) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          try {
            await doFetch(newToken);
            setError(null);
            return;
          } catch {
            /* fall through to set error */
          }
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setConsecutiveFailures((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, accessToken, selectedCalendarIds, daysAhead, cacheKey, refreshInterval, getEntry, setEntry, refreshAccessToken]);

  // Always fetch calendar list when authenticated (needed for settings dropdown even when none selected)
  useEffect(() => {
    if (!enabled) return;
    if (isAuthenticated) void fetchCalendars();
  }, [enabled, isAuthenticated, fetchCalendars]);

  useEffect(() => {
    if (!enabled) return;
    if (isAuthenticated && selectedCalendarIds.length > 0) void fetchEvents();
  }, [enabled, isAuthenticated, selectedCalendarIds, fetchEvents]);

  useEffect(() => {
    if (!enabled) return;
    if (!isAuthenticated || selectedCalendarIds.length === 0) return;
    const interval = setTimeout(
      () => void fetchEvents(true),
      getNextPollDelay(refreshInterval, consecutiveFailures)
    );
    return () => clearTimeout(interval);
  }, [enabled, isAuthenticated, selectedCalendarIds, fetchEvents, refreshInterval, consecutiveFailures]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      setConsecutiveFailures(0);
    }
  }, [enabled]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    void fetchCalendars();
    void fetchEvents(true);
  }, [enabled, fetchCalendars, fetchEvents]);

  const withTokenRetry = useCallback(
    async <T>(fn: (token: string) => Promise<T>): Promise<T> => {
      if (!accessToken) throw new Error('Not authenticated');
      try {
        return await fn(accessToken);
      } catch (err) {
        if (err instanceof Error && err.message === TOKEN_EXPIRED_MSG) {
          const newToken = await refreshAccessToken();
          if (newToken) return fn(newToken);
        }
        throw err;
      }
    },
    [accessToken, refreshAccessToken]
  );

  const addEvent = useCallback(
    async (calendarId: string, event: CalendarEventInput) => {
      await withTokenRetry((token) => createCalendarEvent(token, calendarId, event));
      void fetchEvents();
    },
    [withTokenRetry, fetchEvents]
  );

  const editEvent = useCallback(
    async (calendarId: string, eventId: string, event: CalendarEventInput) => {
      await withTokenRetry((token) => updateCalendarEvent(token, calendarId, eventId, event));
      void fetchEvents();
    },
    [withTokenRetry, fetchEvents]
  );

  const removeEvent = useCallback(
    async (calendarId: string, eventId: string) => {
      await withTokenRetry((token) => deleteCalendarEvent(token, calendarId, eventId));
      void fetchEvents();
    },
    [withTokenRetry, fetchEvents]
  );

  return {
    isAuthenticated,
    isLoading,
    error,
    calendars,
    events,
    lastUpdated,
    refresh,
    addEvent,
    editEvent,
    removeEvent,
  };
}
