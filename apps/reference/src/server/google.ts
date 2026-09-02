import { randomBytes, timingSafeEqual } from 'node:crypto';

export const DEFAULT_REFERENCE_PUBLIC_BASE_URL = 'http://127.0.0.1:8787';

export const GOOGLE_OAUTH_STATE_COOKIE = 'homeslate_oauth_state';

/** Google discards the state after the callback, so a short window is enough. */
export const GOOGLE_OAUTH_STATE_MAX_AGE_S = 600;

const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export function googleRedirectUri(publicBaseUrl: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}/api/google/callback`;
}

export function createOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

export function isMatchingOAuthState(
  received: string | undefined,
  expected: string | undefined,
): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function googleAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString();
  return url.toString();
}
