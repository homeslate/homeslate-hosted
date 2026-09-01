import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleClient } from './client';
import { GoogleAuthError } from './errors';
import type { GoogleTokens, TokenStore } from './types';

afterEach(() => {
  vi.unstubAllGlobals();
});

function memoryTokenStore(initial: Record<string, GoogleTokens> = {}): TokenStore {
  const data = new Map(Object.entries(initial));
  return {
    async getRefreshToken(accountId) {
      const tokens = data.get(accountId);
      return tokens?.refreshToken ? tokens.refreshToken : null;
    },
    async getTokens(accountId) {
      return data.get(accountId) ?? null;
    },
    async putTokens(accountId, tokens) {
      data.set(accountId, tokens);
    },
    async deleteTokens(accountId) {
      data.delete(accountId);
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createGoogleClient', () => {
  it('throws when clientId or clientSecret is missing', () => {
    const store = memoryTokenStore();
    expect(() =>
      createGoogleClient({ clientId: '', clientSecret: 's', tokenStore: store })
    ).toThrow('Missing Google OAuth credentials');
    expect(() =>
      createGoogleClient({ clientId: 'c', clientSecret: '  ', tokenStore: store })
    ).toThrow('Missing Google OAuth credentials');
  });

  it('returns a stored access token that is still valid', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = createGoogleClient({
      clientId: 'cid',
      clientSecret: 'csecret',
      tokenStore: memoryTokenStore({
        local: {
          refreshToken: 'rt',
          accessToken: 'cached-at',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      }),
    });

    await expect(client.getAccessToken('local')).resolves.toBe('cached-at');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes, persists rotated tokens, and returns the new access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, {
          access_token: 'new-at',
          refresh_token: 'rotated-rt',
          expires_in: 3600,
        })
      )
    );
    const store = memoryTokenStore({
      acc: {
        refreshToken: 'old-rt',
        accessToken: 'old-at',
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    });
    const client = createGoogleClient({
      clientId: 'cid',
      clientSecret: 'csecret',
      tokenStore: store,
    });

    await expect(client.getAccessToken('acc')).resolves.toBe('new-at');
    const stored = await store.getTokens('acc');
    expect(stored?.refreshToken).toBe('rotated-rt');
    expect(stored?.accessToken).toBe('new-at');
  });

  it('keeps the previous refresh token when Google does not rotate it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { access_token: 'new-at', expires_in: 3600 }))
    );
    const store = memoryTokenStore({
      acc: { refreshToken: 'keep-rt', expiresAt: '2020-01-01T00:00:00.000Z' },
    });
    const client = createGoogleClient({
      clientId: 'cid',
      clientSecret: 'csecret',
      tokenStore: store,
    });

    await client.getAccessToken('acc');
    expect((await store.getTokens('acc'))?.refreshToken).toBe('keep-rt');
  });

  it('throws GoogleAuthError missing_tokens when nothing is stored', async () => {
    const client = createGoogleClient({
      clientId: 'cid',
      clientSecret: 'csecret',
      tokenStore: memoryTokenStore(),
    });

    await expect(client.getAccessToken('missing')).rejects.toMatchObject({
      code: 'missing_tokens',
    });
  });

  it('maps invalid_grant from refresh to GoogleAuthError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(400, { error: 'invalid_grant' }))
    );
    const client = createGoogleClient({
      clientId: 'cid',
      clientSecret: 'csecret',
      tokenStore: memoryTokenStore({
        acc: { refreshToken: 'rt', expiresAt: '2020-01-01T00:00:00.000Z' },
      }),
    });

    await expect(client.getAccessToken('acc')).rejects.toBeInstanceOf(GoogleAuthError);
    await expect(client.getAccessToken('acc')).rejects.toMatchObject({
      code: 'invalid_grant',
    });
  });

  it('exchangeAuthCode persists tokens for the account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, {
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
        })
      )
    );
    const store = memoryTokenStore();
    const client = createGoogleClient({
      clientId: 'cid',
      clientSecret: 'csecret',
      tokenStore: store,
    });

    const tokens = await client.exchangeAuthCode('local', 'code', 'https://app.example/oauth');
    expect(tokens.refreshToken).toBe('rt');
    expect(tokens.accessToken).toBe('at');
    expect(await store.getTokens('local')).toEqual(tokens);
  });

  it('exchangeAuthCode keeps an existing refresh token when Google omits one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { access_token: 'at-2', expires_in: 3600 }))
    );
    const store = memoryTokenStore({
      local: { refreshToken: 'existing-rt', accessToken: 'old' },
    });
    const client = createGoogleClient({
      clientId: 'cid',
      clientSecret: 'csecret',
      tokenStore: store,
    });

    const tokens = await client.exchangeAuthCode('local', 'code', 'https://app.example/oauth');
    expect(tokens.refreshToken).toBe('existing-rt');
    expect(tokens.accessToken).toBe('at-2');
  });
});
