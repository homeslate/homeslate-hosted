import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeAuthorizationCode, refreshAccessToken } from './tokens';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('exchangeAuthorizationCode', () => {
  it('POSTs the authorization code and returns camelCase tokens', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, {
        access_token: 'at-1',
        refresh_token: 'rt-1',
        expires_in: 3600,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const grant = await exchangeAuthorizationCode({
      clientId: 'cid',
      clientSecret: 'csecret',
      code: 'auth-code',
      redirectUri: 'https://app.example/oauth',
      nowMs: Date.parse('2026-08-31T00:00:00.000Z'),
    });

    expect(grant).toEqual({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      expiresIn: 3600,
      expiresAt: '2026-08-31T01:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init).toBeDefined();
    expect(init!.method).toBe('POST');
    const body = new URLSearchParams(String(init!.body));
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('client_secret')).toBe('csecret');
    expect(body.get('redirect_uri')).toBe('https://app.example/oauth');
    expect(body.get('grant_type')).toBe('authorization_code');
  });
});

describe('refreshAccessToken', () => {
  it('POSTs the refresh token and returns a grant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, { access_token: 'at-2', expires_in: 1800 })
      )
    );

    const grant = await refreshAccessToken({
      clientId: 'cid',
      clientSecret: 'csecret',
      refreshToken: 'rt-1',
      nowMs: Date.parse('2026-08-31T00:00:00.000Z'),
    });

    expect(grant.accessToken).toBe('at-2');
    expect(grant.refreshToken).toBeUndefined();
    expect(grant.expiresIn).toBe(1800);
    expect(grant.expiresAt).toBe('2026-08-31T00:30:00.000Z');
  });

  it('throws GoogleAuthError invalid_grant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(400, { error: 'invalid_grant' }))
    );

    await expect(
      refreshAccessToken({
        clientId: 'cid',
        clientSecret: 'csecret',
        refreshToken: 'rt-bad',
      })
    ).rejects.toMatchObject({
      name: 'GoogleAuthError',
      code: 'invalid_grant',
    });
  });

  it('maps expired-or-revoked to token_revoked even when error is invalid_grant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(400, {
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.',
        })
      )
    );

    await expect(
      refreshAccessToken({
        clientId: 'cid',
        clientSecret: 'csecret',
        refreshToken: 'rt-revoked',
      })
    ).rejects.toMatchObject({ code: 'token_revoked' });
  });
});
