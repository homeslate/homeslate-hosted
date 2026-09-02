export const DEFAULT_REFERENCE_PUBLIC_BASE_URL = 'http://127.0.0.1:8787';

const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export function googleRedirectUri(publicBaseUrl: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}/api/google/callback`;
}

export function googleAuthorizationUrl(clientId: string, redirectUri: string): string {
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();
  return url.toString();
}
