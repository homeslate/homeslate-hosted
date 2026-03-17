import { useState, useEffect, useCallback } from 'react';
import { fetchCalendarEventsCached, type CalendarEvent } from '../services/calendar';
import { getNextPollDelay } from './polling';

interface UseCalendarOptions {
  icalUrl: string;
  daysAhead?: number;
  refreshInterval?: number;
}

interface UseCalendarResult {
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
}

export function useCalendar({
  icalUrl,
  daysAhead = 30,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
}: UseCalendarOptions): UseCalendarResult {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const fetchData = useCallback(async () => {
    if (!icalUrl) {
      setEvents([]);
      setError(null);
      setLastUpdated(null);
      setConsecutiveFailures(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const calendarEvents = await fetchCalendarEventsCached(icalUrl, daysAhead);
      setEvents(calendarEvents);
      setLastUpdated(Date.now());
      setConsecutiveFailures(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar');
      setConsecutiveFailures((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  }, [icalUrl, daysAhead]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!icalUrl) return;

    const timeout = setTimeout(
      fetchData,
      getNextPollDelay(refreshInterval, consecutiveFailures)
    );
    return () => clearTimeout(timeout);
  }, [fetchData, refreshInterval, icalUrl, consecutiveFailures]);

  return {
    events,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchData,
  };
}

