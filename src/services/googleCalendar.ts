// Google Calendar API Service with OAuth 2.0
// Requires a Google Cloud Project with Calendar API enabled
// See docs/GOOGLE_CALENDAR_SETUP.md for setup instructions

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  selected?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
  status: string;
  htmlLink?: string;
}

export interface ParsedCalendarEvent {
  id: string;
  calendarId: string;
  calendarName?: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
  htmlLink?: string;
}

// Google Calendar event colorId → hex color
const GOOGLE_EVENT_COLORS: Record<string, string> = {
  '1': '#7986CB', // Lavender
  '2': '#33B679', // Sage
  '3': '#8E24AA', // Grape
  '4': '#E67C73', // Flamingo
  '5': '#F6BF26', // Banana
  '6': '#F4511E', // Tangerine
  '7': '#039BE5', // Peacock
  '8': '#3F51B5', // Blueberry
  '9': '#0F9D58', // Basil
  '10': '#D50000', // Tomato
  '11': '#616161', // Graphite
};

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

const TOKEN_KEY = 'gcal_access_token';
const TOKEN_EXPIRY_KEY = 'gcal_token_expiry';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  callback: (response: GoogleTokenResponse) => void;
  requestAccessToken: (config?: { prompt?: string }) => void;
}

interface GoogleOauth2Api {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
  }) => GoogleTokenClient;
  revoke: (token: string, callback: () => void) => void;
}

interface GoogleIdentityServices {
  accounts?: {
    oauth2?: GoogleOauth2Api;
  };
}

// Token storage
let accessToken: string | null = null;
let tokenExpiry: number | null = null;
let tokenClient: GoogleTokenClient | null = null;

function getOauth2Api(): GoogleOauth2Api | null {
  if (typeof google === 'undefined') return null;
  return google.accounts?.oauth2 ?? null;
}

// Check if Google Identity Services is loaded
function isGoogleLoaded(): boolean {
  return getOauth2Api() !== null;
}

/**
 * Restore a previously saved token from localStorage if it hasn't expired
 */
function restoreToken(): void {
  const stored = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (stored && expiry) {
    const expiryMs = parseInt(expiry, 10);
    if (Date.now() < expiryMs) {
      accessToken = stored;
      tokenExpiry = expiryMs;
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  }
}

/**
 * Initialize Google OAuth client
 */
export function initGoogleAuth(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!clientId) {
      reject(new Error('Google Client ID is required'));
      return;
    }

    // Restore any saved token before initializing
    restoreToken();

    // Check if script is already loaded
    if (isGoogleLoaded()) {
      setupTokenClient(clientId);
      resolve();
      return;
    }

    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Wait a bit for google object to be fully initialized
      setTimeout(() => {
        if (isGoogleLoaded()) {
          setupTokenClient(clientId);
          resolve();
        } else {
          reject(new Error('Failed to initialize Google Identity Services'));
        }
      }, 100);
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

function setupTokenClient(clientId: string) {
  const oauth2 = getOauth2Api();
  if (!oauth2) {
    throw new Error('Google Identity Services not loaded');
  }
  tokenClient = oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: () => {}, // Will be set during auth request
  });
}

/**
 * Request Google OAuth token (triggers popup)
 */
export function requestGoogleAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized. Call initGoogleAuth first.'));
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      
      accessToken = response.access_token;
      // Token typically expires in 1 hour
      tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
      // Persist so page reloads within the expiry window don't require re-auth
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(tokenExpiry));
      resolve(response.access_token);
    };

    // Request token - this will show the Google sign-in popup
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Check if we have a valid token
 */
export function hasValidToken(): boolean {
  return accessToken !== null && tokenExpiry !== null && Date.now() < tokenExpiry;
}

/**
 * Get current access token
 */
export function getAccessToken(): string | null {
  if (hasValidToken()) {
    return accessToken;
  }
  return null;
}

/**
 * Clear stored token (sign out)
 */
export function clearGoogleAuth(): void {
  const oauth2 = getOauth2Api();
  if (accessToken && oauth2) {
    oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiry = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Fetch user's calendar list
 */
export async function fetchCalendarList(token: string): Promise<GoogleCalendar[]> {
  const response = await fetch(`${GOOGLE_API_BASE}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      accessToken = null;
      tokenExpiry = null;
      throw new Error('Token expired. Please sign in again.');
    }
    throw new Error(`Failed to fetch calendars: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Fetch events from a specific calendar
 */
export async function fetchCalendarEvents(
  token: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  maxResults: number = 50
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: maxResults.toString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const response = await fetch(
    `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      accessToken = null;
      tokenExpiry = null;
      throw new Error('Token expired. Please sign in again.');
    }
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Fetch events from multiple calendars
 */
export async function fetchAllCalendarEvents(
  token: string,
  calendarIds: string[],
  daysAhead: number = 30
): Promise<ParsedCalendarEvent[]> {
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const timeMax = new Date(timeMin.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  // Fetch calendars to get colors
  const calendars = await fetchCalendarList(token);
  const calendarMap = new Map(calendars.map(c => [c.id, c]));

  // Fetch events from all selected calendars
  const allEvents: ParsedCalendarEvent[] = [];
  
  for (const calendarId of calendarIds) {
    try {
      const events = await fetchCalendarEvents(token, calendarId, timeMin, timeMax);
      const calendar = calendarMap.get(calendarId);
      
      for (const event of events) {
        if (event.status === 'cancelled') continue;
        
        const parsed = parseGoogleEvent(event, calendarId, calendar?.backgroundColor || '#4285f4', calendar?.summary);
        if (parsed) {
          allEvents.push(parsed);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch events for calendar ${calendarId}:`, err);
    }
  }

  // Sort by start time
  return allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Parse a Google Calendar event into our format
 */
function parseGoogleEvent(
  event: GoogleCalendarEvent,
  calendarId: string,
  calendarColor: string,
  calendarName?: string
): ParsedCalendarEvent | null {
  const startDate = event.start.dateTime 
    ? new Date(event.start.dateTime)
    : event.start.date 
      ? new Date(event.start.date + 'T00:00:00')
      : null;
      
  const endDate = event.end.dateTime
    ? new Date(event.end.dateTime)
    : event.end.date
      ? new Date(event.end.date + 'T23:59:59')
      : null;

  if (!startDate || !endDate) return null;

  // Event-specific colorId overrides calendar color
  const color = event.colorId ? (GOOGLE_EVENT_COLORS[event.colorId] ?? calendarColor) : calendarColor;

  return {
    id: event.id,
    calendarId,
    calendarName,
    title: event.summary || '(No title)',
    description: event.description,
    location: event.location,
    start: startDate,
    end: endDate,
    allDay: !event.start.dateTime,
    color,
    htmlLink: event.htmlLink,
  };
}

/**
 * Input shape for creating or updating a calendar event
 */
export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
}

/**
 * Create a new event in a calendar
 */
export async function createCalendarEvent(
  token: string,
  calendarId: string,
  event: CalendarEventInput
): Promise<GoogleCalendarEvent> {
  const response = await fetch(
    `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      accessToken = null;
      tokenExpiry = null;
      throw new Error('Token expired. Please sign in again.');
    }
    throw new Error(`Failed to create event: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update an existing event (full replace)
 */
export async function updateCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: CalendarEventInput
): Promise<GoogleCalendarEvent> {
  const response = await fetch(
    `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      accessToken = null;
      tokenExpiry = null;
      throw new Error('Token expired. Please sign in again.');
    }
    throw new Error(`Failed to update event: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Delete an event from a calendar
 */
export async function deleteCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      accessToken = null;
      tokenExpiry = null;
      throw new Error('Token expired. Please sign in again.');
    }
    if (response.status === 410) return; // already deleted
    throw new Error(`Failed to delete event: ${response.statusText}`);
  }
}

// Type declaration for Google Identity Services
declare const google: GoogleIdentityServices;

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

