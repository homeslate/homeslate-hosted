import { useState, useEffect, useCallback } from 'react';
import {
  initGoogleAuth,
  requestGoogleAuth,
  hasValidToken,
  getAccessToken,
  clearGoogleAuth,
  fetchCalendarList,
  fetchAllCalendarEvents,
  type GoogleCalendar,
  type ParsedCalendarEvent,
} from '../services/googleCalendar';

interface UseGoogleCalendarOptions {
  clientId: string;
  selectedCalendarIds: string[];
  daysAhead?: number;
  refreshInterval?: number;
}

interface UseGoogleCalendarResult {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  calendars: GoogleCalendar[];
  events: ParsedCalendarEvent[];
  signIn: () => Promise<void>;
  signOut: () => void;
  refresh: () => void;
}

export function useGoogleCalendar({
  clientId,
  selectedCalendarIds,
  daysAhead = 30,
  refreshInterval = 5 * 60 * 1000,
}: UseGoogleCalendarOptions): UseGoogleCalendarResult {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [events, setEvents] = useState<ParsedCalendarEvent[]>([]);

  // Initialize Google Auth
  useEffect(() => {
    if (!clientId) {
      setIsInitialized(false);
      return;
    }

    initGoogleAuth(clientId)
      .then(() => {
        setIsInitialized(true);
        // Check if we already have a valid token
        if (hasValidToken()) {
          setIsAuthenticated(true);
        }
      })
      .catch((err) => {
        setError(err.message);
        setIsInitialized(false);
      });
  }, [clientId]);

  // Fetch calendars when authenticated
  const fetchCalendars = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const calendarList = await fetchCalendarList(token);
      setCalendars(calendarList);
    } catch (err) {
      if (err instanceof Error && err.message.includes('expired')) {
        setIsAuthenticated(false);
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch calendars');
    }
  }, []);

  // Fetch events from selected calendars
  const fetchEvents = useCallback(async () => {
    const token = getAccessToken();
    if (!token || selectedCalendarIds.length === 0) {
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const calendarEvents = await fetchAllCalendarEvents(token, selectedCalendarIds, daysAhead);
      setEvents(calendarEvents);
    } catch (err) {
      if (err instanceof Error && err.message.includes('expired')) {
        setIsAuthenticated(false);
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCalendarIds, daysAhead]);

  // Fetch calendars when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchCalendars();
    }
  }, [isAuthenticated, fetchCalendars]);

  // Fetch events when calendars are selected
  useEffect(() => {
    if (isAuthenticated && selectedCalendarIds.length > 0) {
      fetchEvents();
    }
  }, [isAuthenticated, selectedCalendarIds, fetchEvents]);

  // Auto-refresh events
  useEffect(() => {
    if (!isAuthenticated || selectedCalendarIds.length === 0) return;

    const interval = setInterval(fetchEvents, refreshInterval);
    return () => clearInterval(interval);
  }, [isAuthenticated, selectedCalendarIds, fetchEvents, refreshInterval]);

  const signIn = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      await requestGoogleAuth();
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    clearGoogleAuth();
    setIsAuthenticated(false);
    setCalendars([]);
    setEvents([]);
  }, []);

  const refresh = useCallback(() => {
    fetchCalendars();
    fetchEvents();
  }, [fetchCalendars, fetchEvents]);

  return {
    isInitialized,
    isAuthenticated,
    isLoading,
    error,
    calendars,
    events,
    signIn,
    signOut,
    refresh,
  };
}

