import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCalendarsWithAccessToken, listEventsWithAccessToken } from './calendar';
import { createGoogleClient } from './client';
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

const calendarList = {
  items: [
    { id: 'cal-1', summary: 'Work', backgroundColor: '#ff0000' },
    { id: 'cal-2', summary: 'Home', backgroundColor: '#00ff00' },
  ],
};

describe('listCalendarsWithAccessToken', () => {
  it('returns calendar list items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toContain('/users/me/calendarList');
        return jsonResponse(200, calendarList);
      })
    );

    await expect(listCalendarsWithAccessToken('tok')).resolves.toEqual([
      { id: 'cal-1', summary: 'Work', backgroundColor: '#ff0000' },
      { id: 'cal-2', summary: 'Home', backgroundColor: '#00ff00' },
    ]);
  });
});

describe('listEventsWithAccessToken', () => {
  it('parses events, skips cancelled, applies colorId, and sorts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const href = String(url);
        if (href.includes('calendarList')) return jsonResponse(200, calendarList);
        if (href.includes(encodeURIComponent('cal-1'))) {
          return jsonResponse(200, {
            items: [
              {
                id: 'e-late',
                summary: 'Later',
                status: 'confirmed',
                start: { dateTime: '2026-08-31T12:00:00Z' },
                end: { dateTime: '2026-08-31T13:00:00Z' },
              },
              {
                id: 'e-cancel',
                summary: 'Nope',
                status: 'cancelled',
                start: { dateTime: '2026-08-31T08:00:00Z' },
                end: { dateTime: '2026-08-31T09:00:00Z' },
              },
              {
                id: 'e-early',
                summary: 'Standup',
                status: 'confirmed',
                colorId: '1',
                start: { dateTime: '2026-08-31T09:00:00Z' },
                end: { dateTime: '2026-08-31T09:30:00Z' },
                htmlLink: 'https://cal.example/e-early',
              },
            ],
          });
        }
        return jsonResponse(200, { items: [] });
      })
    );

    const events = await listEventsWithAccessToken('tok', {
      calendarIds: ['cal-1'],
      timeMin: '2026-08-31T00:00:00.000Z',
      timeMax: '2026-09-30T00:00:00.000Z',
    });

    expect(events.map((event) => event.id)).toEqual(['e-early', 'e-late']);
    expect(events[0]).toMatchObject({
      calendarId: 'cal-1',
      calendarName: 'Work',
      title: 'Standup',
      allDay: false,
      color: '#7986CB',
      htmlLink: 'https://cal.example/e-early',
      start: '2026-08-31T09:00:00Z',
      end: '2026-08-31T09:30:00Z',
    });
  });

  it('marks all-day events and uses calendar color when colorId is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, {
          items: [
            {
              id: 'all-day',
              status: 'confirmed',
              start: { date: '2026-09-01' },
              end: { date: '2026-09-02' },
            },
          ],
        })
      )
    );

    const events = await listEventsWithAccessToken('tok', {
      calendarIds: ['cal-1'],
      timeMin: '2026-08-31T00:00:00.000Z',
      timeMax: '2026-09-30T00:00:00.000Z',
      calendarList: [{ id: 'cal-1', summary: 'Work', backgroundColor: '#ff0000' }],
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.allDay).toBe(true);
    expect(events[0]?.title).toBe('(No title)');
    expect(events[0]?.color).toBe('#ff0000');
    expect(events[0]?.start).toBe('2026-09-01');
    expect(events[0]?.end).toBe('2026-09-02');
  });

  it('skips calendars that fail to fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes(encodeURIComponent('bad'))) {
          return jsonResponse(404, { error: 'not found' });
        }
        return jsonResponse(200, {
          items: [
            {
              id: 'ok',
              summary: 'Ok',
              status: 'confirmed',
              start: { dateTime: '2026-08-31T10:00:00Z' },
              end: { dateTime: '2026-08-31T11:00:00Z' },
            },
          ],
        });
      })
    );

    const events = await listEventsWithAccessToken('tok', {
      calendarIds: ['bad', 'cal-1'],
      timeMin: '2026-08-31T00:00:00.000Z',
      timeMax: '2026-09-30T00:00:00.000Z',
      calendarList: [
        { id: 'bad', summary: 'Bad' },
        { id: 'cal-1', summary: 'Work' },
      ],
    });

    expect(events.map((event) => event.id)).toEqual(['ok']);
  });
});

describe('GoogleClient.listEvents', () => {
  it('uses the stored access token and returns events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('calendarList')) return jsonResponse(200, calendarList);
        return jsonResponse(200, {
          items: [
            {
              id: 'e1',
              summary: 'Hi',
              status: 'confirmed',
              start: { dateTime: '2026-08-31T10:00:00Z' },
              end: { dateTime: '2026-08-31T11:00:00Z' },
            },
          ],
        });
      })
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

    const events = await client.listEvents('acc', {
      calendarIds: ['cal-1'],
      timeMin: '2026-08-31T00:00:00.000Z',
      timeMax: '2026-09-30T00:00:00.000Z',
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Hi');
  });
});
