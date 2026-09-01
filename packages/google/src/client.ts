import { listCalendarsWithAccessToken, listEventsWithAccessToken } from './calendar';
import { GoogleAuthError, isGoogleAuthError } from './errors';
import { exchangeAuthorizationCode, refreshAccessToken } from './tokens';
import type { GoogleClient, GoogleTokens, TokenStore } from './types';

const ACCESS_TOKEN_SAFETY_MS = 60_000;

function requireCredentials(clientId: string, clientSecret: string): void {
  if (!clientId.trim() || !clientSecret.trim()) {
    throw new Error('Missing Google OAuth credentials');
  }
}

function isAccessTokenUnexpired(expiresAt: string | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs > nowMs + ACCESS_TOKEN_SAFETY_MS;
}

export function createGoogleClient(opts: {
  clientId: string;
  clientSecret: string;
  tokenStore: TokenStore;
}): GoogleClient {
  requireCredentials(opts.clientId, opts.clientSecret);
  const { clientId, clientSecret, tokenStore } = opts;

  async function getAccessToken(accountId: string): Promise<string> {
    const stored = await tokenStore.getTokens(accountId);
    const nowMs = Date.now();
    if (stored?.accessToken && isAccessTokenUnexpired(stored.expiresAt, nowMs)) {
      return stored.accessToken;
    }

    const refreshToken = stored?.refreshToken || (await tokenStore.getRefreshToken(accountId));
    if (!refreshToken) {
      throw new GoogleAuthError(
        'missing_tokens',
        'No Google refresh token is stored for this account'
      );
    }

    let grant;
    try {
      grant = await refreshAccessToken({ clientId, clientSecret, refreshToken, nowMs });
    } catch (err) {
      if (isGoogleAuthError(err)) throw err;
      throw new GoogleAuthError(
        'refresh_failed',
        err instanceof Error ? err.message : String(err)
      );
    }

    const next: GoogleTokens = {
      refreshToken: grant.refreshToken ?? refreshToken,
      accessToken: grant.accessToken,
      expiresAt: grant.expiresAt,
    };
    await tokenStore.putTokens(accountId, next);
    return grant.accessToken;
  }

  async function exchangeAuthCode(
    accountId: string,
    code: string,
    redirectUri: string
  ): Promise<GoogleTokens> {
    const grant = await exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
    const existing = await tokenStore.getTokens(accountId);
    const refreshToken = grant.refreshToken ?? existing?.refreshToken;
    if (!refreshToken) {
      throw new Error('Auth code exchange did not return a refresh token');
    }
    const tokens: GoogleTokens = {
      refreshToken,
      accessToken: grant.accessToken,
      expiresAt: grant.expiresAt,
    };
    await tokenStore.putTokens(accountId, tokens);
    return tokens;
  }

  return {
    exchangeAuthCode,
    getAccessToken,
    async listCalendars(accountId: string) {
      const token = await getAccessToken(accountId);
      return listCalendarsWithAccessToken(token);
    },
    async listEvents(accountId, params) {
      const token = await getAccessToken(accountId);
      return listEventsWithAccessToken(token, params);
    },
    async fetchPhoto() {
      throw new Error('fetchPhoto not implemented');
    },
  };
}
