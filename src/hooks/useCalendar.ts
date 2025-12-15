import { useState, useEffect, useCallback } from 'react';
import { fetchCalendarEventsCached, type CalendarEvent } from '../services/calendar';

interface UseCalendarOptions {
  icalUrl: string;
  daysAhead?: number;
  refreshInterval?: number;
}

interface UseCalendarResult {
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
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

  const fetchData = useCallback(async () => {
    if (!icalUrl) {
      setEvents([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const calendarEvents = await fetchCalendarEventsCached(icalUrl, daysAhead);
      setEvents(calendarEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [icalUrl, daysAhead]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!icalUrl) return;
    
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, icalUrl]);

  return {
    events,
    isLoading,
    error,
    refresh: fetchData,
  };
}

