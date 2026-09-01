import { GoogleAuthError } from './errors';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type TokenGrant = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  expiresAt: string;
};

async function parseGoogleTokenError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: string; error_description?: string };
    const parts = [data.error, data.error_description].filter(
      (part): part is string => typeof part === 'string' && part.length > 0
    );
    return parts.length > 0 ? parts.join(': ') : text;
  } catch {
    return text;
  }
}

export function googleAuthErrorFromDetail(detail: string): GoogleAuthError {
  if (/expired or revoked/i.test(detail)) {
    return new GoogleAuthError('token_revoked', `Refresh token exchange failed: ${detail}`);
  }
  if (/invalid_grant/i.test(detail)) {
    return new GoogleAuthError('invalid_grant', `Refresh token exchange failed: ${detail}`);
  }
  return new GoogleAuthError('refresh_failed', `Refresh token exchange failed: ${detail}`);
}

function toGrant(
  data: { access_token?: string; refresh_token?: string; expires_in?: number },
  nowMs: number
): TokenGrant {
  if (!data.access_token) {
    throw new GoogleAuthError('refresh_failed', 'Token response missing access_token');
  }
  const expiresIn = data.expires_in ?? 3600;
  const refreshToken = data.refresh_token?.trim();
  return {
    accessToken: data.access_token,
    refreshToken: refreshToken && refreshToken.length > 0 ? refreshToken : undefined,
    expiresIn,
    expiresAt: new Date(nowMs + expiresIn * 1000).toISOString(),
  };
}

async function postToken(body: URLSearchParams): Promise<Response> {
  return fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

export async function exchangeAuthorizationCode(opts: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  nowMs?: number;
}): Promise<TokenGrant> {
  const res = await postToken(
    new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    })
  );
  if (!res.ok) {
    const detail = await parseGoogleTokenError(res);
    throw new Error(`Auth code exchange failed: ${detail}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return toGrant(data, opts.nowMs ?? Date.now());
}

export async function refreshAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  nowMs?: number;
}): Promise<TokenGrant> {
  const res = await postToken(
    new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      refresh_token: opts.refreshToken,
      grant_type: 'refresh_token',
    })
  );
  if (!res.ok) {
    const detail = await parseGoogleTokenError(res);
    throw googleAuthErrorFromDetail(detail);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return toGrant(data, opts.nowMs ?? Date.now());
}
