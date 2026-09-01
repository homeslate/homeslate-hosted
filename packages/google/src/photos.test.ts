import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleClient } from './client';
import { fetchPhotoWithAccessToken } from './photos';
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

describe('fetchPhotoWithAccessToken', () => {
  it('rejects non-Google URLs without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchPhotoWithAccessToken('tok', {
        baseUrl: 'https://evil.example/pic',
        size: 'w800-h600',
      })
    ).rejects.toThrow('URL not allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches an allowlisted Google Photos URL and returns bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://lh3.googleusercontent.com/abc=w800-h600');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
      return new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPhotoWithAccessToken('tok', {
      baseUrl: 'https://lh3.googleusercontent.com/abc',
      size: 'w800-h600',
    });
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it('throws when Google Photos returns a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 403 }))
    );

    await expect(
      fetchPhotoWithAccessToken('tok', {
        baseUrl: 'https://photos.googleapis.com/media/1',
        size: 'w100',
      })
    ).rejects.toThrow('Google Photos fetch failed: 403');
  });
});

describe('GoogleClient.fetchPhoto', () => {
  it('uses getAccessToken then fetches bytes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([9]), { status: 200 }))
    );
    const client = createGoogleClient({
      clientId: 'cid',
      clientSecret: 'csecret',
      tokenStore: memoryTokenStore({
        acc: {
          refreshToken: 'rt',
          accessToken: 'tok',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      }),
    });

    const result = await client.fetchPhoto('acc', {
      baseUrl: 'https://lh3.googleusercontent.com/abc',
      size: 'w10',
    });
    expect(Array.from(result)).toEqual([9]);
  });
});
