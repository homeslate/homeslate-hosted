// Calendar Service - iCal Feed Parser
// Works with any calendar that provides an iCal/ICS feed
// Google Calendar: Settings > Calendar > "Secret address in iCal format"
// Outlook: Share > Get a link > ICS
// Apple: Share Calendar > Public Calendar

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
}

// CORS proxy for fetching iCal feeds from browser
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Parse an iCal/ICS feed and extract events
 */
export async function fetchCalendarEvents(
  icalUrl: string,
  daysAhead: number = 30
): Promise<CalendarEvent[]> {
  if (!icalUrl) {
    return [];
  }

  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(icalUrl)}`;
  
  const response = await fetch(proxyUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar: ${response.statusText}`);
  }
  
  const icalText = await response.text();
  return parseICalEvents(icalText, daysAhead);
}

/**
 * Parse iCal text format into CalendarEvent objects
 */
function parseICalEvents(icalText: string, daysAhead: number): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const now = new Date();
  const maxDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  // Split into event blocks
  const eventBlocks = icalText.split('BEGIN:VEVENT');
  
  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split('END:VEVENT')[0];
    
    try {
      const event = parseEventBlock(block);
      
      if (event && event.start >= now && event.start <= maxDate) {
        events.push(event);
      }
    } catch {
      // Skip malformed events
      continue;
    }
  }
  
  // Sort by start date
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Parse a single VEVENT block
 */
function parseEventBlock(block: string): CalendarEvent | null {
  const lines = unfoldICalLines(block);
  
  const getValue = (key: string): string | undefined => {
    const line = lines.find(l => l.startsWith(key + ':') || l.startsWith(key + ';'));
    if (!line) return undefined;
    
    // Handle property parameters (e.g., DTSTART;VALUE=DATE:20231225)
    const colonIndex = line.indexOf(':');
    return colonIndex >= 0 ? line.slice(colonIndex + 1).trim() : undefined;
  };
  
  const uid = getValue('UID');
  const summary = getValue('SUMMARY');
  const description = getValue('DESCRIPTION');
  const location = getValue('LOCATION');
  
  // Parse dates
  const dtstart = lines.find(l => l.startsWith('DTSTART'));
  const dtend = lines.find(l => l.startsWith('DTEND'));
  
  if (!uid || !summary || !dtstart) {
    return null;
  }
  
  const { date: startDate, allDay } = parseICalDate(dtstart);
  const { date: endDate } = dtend ? parseICalDate(dtend) : { date: startDate };
  
  return {
    id: uid,
    title: unescapeICalText(summary),
    description: description ? unescapeICalText(description) : undefined,
    location: location ? unescapeICalText(location) : undefined,
    start: startDate,
    end: endDate,
    allDay,
  };
}

/**
 * Unfold iCal lines (lines can be split with CRLF + space/tab)
 */
function unfoldICalLines(text: string): string[] {
  // First, unfold continuation lines
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  // Then split by newlines
  return unfolded.split(/\r?\n/).filter(line => line.trim());
}

/**
 * Parse iCal date/datetime string
 */
function parseICalDate(line: string): { date: Date; allDay: boolean } {
  const colonIndex = line.indexOf(':');
  const params = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1).trim();
  
  const allDay = params.includes('VALUE=DATE') || value.length === 8;
  
  if (allDay) {
    // Format: YYYYMMDD
    const year = parseInt(value.slice(0, 4));
    const month = parseInt(value.slice(4, 6)) - 1;
    const day = parseInt(value.slice(6, 8));
    return { date: new Date(year, month, day), allDay: true };
  }
  
  // Format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const year = parseInt(value.slice(0, 4));
  const month = parseInt(value.slice(4, 6)) - 1;
  const day = parseInt(value.slice(6, 8));
  const hour = parseInt(value.slice(9, 11));
  const minute = parseInt(value.slice(11, 13));
  const second = parseInt(value.slice(13, 15)) || 0;
  
  if (value.endsWith('Z')) {
    // UTC time
    return { date: new Date(Date.UTC(year, month, day, hour, minute, second)), allDay: false };
  }
  
  // Check for TZID parameter
  const tzidMatch = params.match(/TZID=([^:;]+)/);
  if (tzidMatch) {
    // For simplicity, we'll create the date in local time
    // A full implementation would use a timezone library
    return { date: new Date(year, month, day, hour, minute, second), allDay: false };
  }
  
  // Local time
  return { date: new Date(year, month, day, hour, minute, second), allDay: false };
}

/**
 * Unescape iCal text values
 */
function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// Cache for calendar data
const calendarCache = new Map<string, { data: CalendarEvent[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchCalendarEventsCached(
  icalUrl: string,
  daysAhead: number = 30
): Promise<CalendarEvent[]> {
  const cacheKey = `${icalUrl}:${daysAhead}`;
  const cached = calendarCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const data = await fetchCalendarEvents(icalUrl, daysAhead);
  calendarCache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}

/**
 * Generate Google Calendar iCal URL from calendar ID
 * Note: This only works for PUBLIC calendars
 */
export function getGoogleCalendarICalUrl(calendarId: string): string {
  const encodedId = encodeURIComponent(calendarId);
  return `https://calendar.google.com/calendar/ical/${encodedId}/public/basic.ics`;
}

