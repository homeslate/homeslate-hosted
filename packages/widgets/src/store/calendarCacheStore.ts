import { create } from 'zustand';
import type { GoogleCalendar, ParsedCalendarEvent } from '../services/googleCalendar';

export interface CalendarCacheEntry {
  calendars: GoogleCalendar[];
  events: ParsedCalendarEvent[];
  fetchedAt: number; // Date.now()
}

interface CalendarCacheState {
  // Key: stable string derived from the widget's config (see cacheKey helper)
  cache: Record<string, CalendarCacheEntry>;
  setEntry: (key: string, entry: CalendarCacheEntry) => void;
  getEntry: (key: string) => CalendarCacheEntry | undefined;
  invalidateEntry: (key: string) => void;
}

export const useCalendarCacheStore = create<CalendarCacheState>()((set, get) => ({
  cache: {},

  setEntry: (key, entry) =>
    set((state) => ({ cache: { ...state.cache, [key]: entry } })),

  getEntry: (key) => get().cache[key],

  invalidateEntry: (key) =>
    set((state) => {
      const next = { ...state.cache };
      delete next[key];
      return { cache: next };
    }),
}));

/** Stable cache key for a given set of calendar IDs + daysAhead. */
export function calendarCacheKey(selectedCalendarIds: string[], daysAhead: number): string {
  return [...selectedCalendarIds].sort().join(',') + '|' + daysAhead;
}
