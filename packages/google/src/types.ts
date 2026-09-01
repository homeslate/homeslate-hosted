export type GoogleTokens = {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: string;
};

export interface TokenStore {
  getRefreshToken(accountId: string): Promise<string | null>;
  getTokens(accountId: string): Promise<GoogleTokens | null>;
  putTokens(accountId: string, tokens: GoogleTokens): Promise<void>;
  deleteTokens(accountId: string): Promise<void>;
}

export interface GoogleBindingStore {
  getAccountIdForDisplay(displayId: string): Promise<string | null>;
  setAccountIdForDisplay(displayId: string, accountId: string): Promise<void>;
}

export type CalendarListItem = {
  id: string;
  summary: string;
  backgroundColor?: string;
  description?: string;
  foregroundColor?: string;
  primary?: boolean;
  selected?: boolean;
};

export type CalendarEvent = {
  id: string;
  calendarId: string;
  calendarName?: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  htmlLink?: string;
};

export type GoogleClient = {
  exchangeAuthCode(accountId: string, code: string, redirectUri: string): Promise<GoogleTokens>;
  getAccessToken(accountId: string): Promise<string>;
  listCalendars(accountId: string): Promise<CalendarListItem[]>;
  listEvents(
    accountId: string,
    params: { calendarIds: string[]; timeMin: string; timeMax: string }
  ): Promise<CalendarEvent[]>;
  fetchPhoto(accountId: string, params: { baseUrl: string; size: string }): Promise<Uint8Array>;
};
