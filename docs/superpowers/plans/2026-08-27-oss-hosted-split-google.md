# OSS Hosted Split — Phase 2: Google Package Implementation Plan

> **Status: complete** (merged to `main` at `611c0d0`, 2026-09-01). `@homeslate/google`, thin Netlify wrappers.

> **For agentic workers:** This plan is done. Do not re-execute. Phase 5 is next after Phases 3–4.

**Goal:** Add `@homeslate/google` with `TokenStore`, `createGoogleClient`, calendar list/events, and photo fetch, then make Netlify functions thin wrappers around those helpers while hosted identity and collaborator pooling stay in the app.

**Architecture:** A new workspace package owns Google token HTTP, calendar reads, and server-side photo bytes. It takes `clientId` / `clientSecret` and a `TokenStore`; it does not import Netlify, Express, Neon, or identity (`tokeninfo` / userinfo). Hosted functions resolve users and displays, then call the package. Browser GIS, the Photos picker, and calendar event CRUD stay in `src/services` until a later UI extraction.

**Tech Stack:** TypeScript 5.9, Vitest 3, npm workspaces, global `fetch`, existing Netlify functions + Neon `users` token columns.

**Spec:** `docs/superpowers/specs/2026-08-27-oss-hosted-split-design.md`

## Global Constraints

- `@homeslate/google` is Calendar/Photos access, not “sign in to Homeslate.”
- The package does not import an HTTP framework, Postgres, Netlify, React, or Neon.
- Identity (`verifyGoogleToken`, `tokeninfo` audience check, user upsert, `/api/me`) stays hosted in `netlify/functions/_shared/googleAuth.ts`.
- `createGoogleClient` throws at construction when `clientId` or `clientSecret` is missing/blank; message is `Missing Google OAuth credentials`.
- `getAccessToken` throws a typed `GoogleAuthError` on `invalid_grant`; host maps that to “Reconnect Google.”
- `CalendarEvent` / `CalendarListItem` match the JSON shapes produced by `display-calendar` (`start`/`end` are strings, not `Date`).
- OSS binding is one Google `accountId` per display. Owner+collaborator token pooling stays hosted-only in `display-calendar`.
- Export `TokenStore` and `GoogleBindingStore` interfaces. Do not implement file/sqlite stores (Phase 5) and do not implement `GoogleBindingStore` in hosted (pooling stays custom).
- Do not greenfield-rewrite. Do not move GIS popup OAuth, Photos picker sessions, or create/update/delete event helpers out of `src/services`.
- Do not change Google Calendar widget UX except as required by the client interface (this plan does not retarget editor widgets at the new types).
- No billing, quota, or Homeslate-account code in `@homeslate/google`.
- MIT public packages; this package is public-core.

## Plan series (this file is Phase 2 only)

Phases 1–4 are done. Do not start Phase 5 until a Phase 5 plan is written.

| Phase | Plan file | Delivers |
|---|---|---|
| 1 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-schema.md` (done) | `@homeslate/schema`, v0→v1, live API persists v1 |
| 2 | this file (done) | `@homeslate/google`, thin Netlify wrappers |
| 3 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-widgets.md` (done) | `@homeslate/widgets` + `registerWidget()` + built-in `configSchema`s |
| 4 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-editor-display.md` (done) | `@homeslate/editor` + `@homeslate/display` |
| 5 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-adapters-reference.md` | `@homeslate/adapters` + `apps/reference` |
| 6 | not written yet | hosted entitlements + private repo split |

## Why hosted still needs token primitives

Spec `GoogleClient.exchangeAuthCode(accountId, code, redirectUri)` persists via `TokenStore`. Hosted `/api/exchange-code` learns `accountId` (the `users.id` uuid) only *after* exchanging the code and looking up `googleId`. Hosted `/api/refresh-token` receives a refresh token from the browser, not an `accountId`. Hosted `/api/photo-store` fetches with the editor session bearer token, not a kiosk `accountId`.

Export both:

- **Primitives** (no `TokenStore`): `exchangeAuthorizationCode`, `refreshAccessToken`, `listCalendarsWithAccessToken`, `listEventsWithAccessToken`, `fetchPhotoWithAccessToken`.
- **`createGoogleClient`** as specified, implemented on top of those primitives.

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/google/package.json` | `@homeslate/google` manifest |
| `packages/google/src/index.ts` | Public exports |
| `packages/google/src/types.ts` | `GoogleTokens`, `TokenStore`, `GoogleBindingStore`, `CalendarEvent`, `CalendarListItem`, `GoogleClient` |
| `packages/google/src/errors.ts` | `GoogleAuthError` |
| `packages/google/src/tokens.ts` | `exchangeAuthorizationCode`, `refreshAccessToken` |
| `packages/google/src/client.ts` | `createGoogleClient` |
| `packages/google/src/calendar.ts` | Calendar list/events + event parse/colors |
| `packages/google/src/photos.ts` | Google Photos baseUrl fetch + allowlist |
| `packages/google/src/*.test.ts` | Package tests (fake `TokenStore`, mocked `fetch`) |
| `netlify/functions/_shared/googleClient.ts` | Read env credentials; `createHostedGoogleClient` |
| `netlify/functions/_shared/neonTokenStore.ts` | Hosted `TokenStore` over `users` rows (`accountId` = `users.id`) |
| Modify: `netlify/functions/exchange-code.ts` | Call `exchangeAuthorizationCode`; identity upsert unchanged |
| Modify: `netlify/functions/refresh-token.ts` | Call `refreshAccessToken`; persist-by-refresh-token unchanged |
| Modify: `netlify/functions/display-calendar.ts` | Pooling stays; token + calendar HTTP go through the package |
| Modify: `netlify/functions/photo-store.ts` | Call `fetchPhotoWithAccessToken`; Blobs storage unchanged |
| Delete: `netlify/functions/_shared/googleTokens.ts` | Replaced by the package |
| Modify: `tsconfig.app.json`, `vite.config.ts`, `vitest.config.ts` | Resolve `@homeslate/google` like `@homeslate/schema` |

Keep unchanged this plan: `netlify/functions/_shared/googleAuth.ts`, `src/services/googleCalendar.ts`, `src/services/googlePhotos.ts`, `src/services/displayCalendarAuth.ts` (pooling helpers remain hosted).

---

### Task 1: Workspace And Google Package Entry

**Files:**
- Modify: `tsconfig.app.json`
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`
- Create: `packages/google/package.json`
- Create: `packages/google/src/index.ts`
- Test: `packages/google/src/index.test.ts`

**Interfaces:**
- Consumes: existing `workspaces: ["packages/*"]` from Phase 1
- Produces: package `@homeslate/google` importable as `export const GOOGLE_PACKAGE_NAME = '@homeslate/google'`

- [ ] **Step 1: Write the failing test**

Create `packages/google/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GOOGLE_PACKAGE_NAME } from '@homeslate/google';

describe('@homeslate/google', () => {
  it('is importable by package name', () => {
    expect(GOOGLE_PACKAGE_NAME).toBe('@homeslate/google');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/google/src/index.test.ts`

Expected: FAIL — cannot resolve `@homeslate/google` (or file not in vitest include).

- [ ] **Step 3: Create the package and wire resolution**

`packages/google/package.json`:

```json
{
  "name": "@homeslate/google",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

`packages/google/src/index.ts`:

```ts
export const GOOGLE_PACKAGE_NAME = '@homeslate/google';
```

In `tsconfig.app.json` `compilerOptions.paths`, add next to the schema mapping:

```json
"@homeslate/google": ["packages/google/src/index.ts"]
```

Change `"include"` to:

```json
"include": ["src", "packages/schema/src", "packages/google/src"]
```

In `vite.config.ts` `resolve.alias`, add:

```ts
'@homeslate/google': fileURLToPath(
  new URL('./packages/google/src/index.ts', import.meta.url)
),
```

In `vitest.config.ts`, add the same alias next to `@homeslate/schema`, and change `test.include` to:

```ts
include: [
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "packages/schema/src/**/*.test.ts",
  "packages/google/src/**/*.test.ts",
],
```

Run: `npm install`

Expected: `node_modules/@homeslate/google` symlink exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/google/src/index.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package-lock.json tsconfig.app.json vite.config.ts vitest.config.ts packages/google
git commit -m "chore: add @homeslate/google workspace package"
```

---

### Task 2: Token Exchange, Refresh, And createGoogleClient

**Files:**
- Create: `packages/google/src/types.ts`
- Create: `packages/google/src/errors.ts`
- Create: `packages/google/src/tokens.ts`
- Create: `packages/google/src/client.ts`
- Modify: `packages/google/src/index.ts`
- Test: `packages/google/src/tokens.test.ts`
- Test: `packages/google/src/client.test.ts`

**Interfaces:**
- Consumes: `GOOGLE_PACKAGE_NAME` from Task 1
- Produces:
  - `export type GoogleTokens = { refreshToken: string; accessToken?: string; expiresAt?: string }`
  - `export interface TokenStore { getRefreshToken(accountId: string): Promise<string | null>; getTokens(accountId: string): Promise<GoogleTokens | null>; putTokens(accountId: string, tokens: GoogleTokens): Promise<void>; deleteTokens(accountId: string): Promise<void> }`
  - `export interface GoogleBindingStore { getAccountIdForDisplay(displayId: string): Promise<string | null>; setAccountIdForDisplay(displayId: string, accountId: string): Promise<void> }`
  - `export type GoogleAuthErrorCode = 'invalid_grant' | 'token_revoked' | 'missing_tokens' | 'refresh_failed'`
  - `export class GoogleAuthError extends Error { readonly code: GoogleAuthErrorCode }`
  - `export function isGoogleAuthError(err: unknown): err is GoogleAuthError`
  - `export type TokenGrant = { accessToken: string; refreshToken?: string; expiresIn: number; expiresAt: string }`
  - `export function exchangeAuthorizationCode(opts: { clientId: string; clientSecret: string; code: string; redirectUri: string; nowMs?: number }): Promise<TokenGrant>`
  - `export function refreshAccessToken(opts: { clientId: string; clientSecret: string; refreshToken: string; nowMs?: number }): Promise<TokenGrant>`
  - `export function createGoogleClient(opts: { clientId: string; clientSecret: string; tokenStore: TokenStore }): GoogleClient`
  - `GoogleClient.exchangeAuthCode(accountId, code, redirectUri): Promise<GoogleTokens>`
  - `GoogleClient.getAccessToken(accountId): Promise<string>`
  - Access-token reuse window: treat `expiresAt` as expired when `expiresAtMs <= nowMs + 60_000` (same 60s safety as `src/services/displayCalendarAuth.ts`)

- [ ] **Step 1: Write the failing tests**

Create `packages/google/src/tokens.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleAuthError } from './errors';
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
    const fetchMock = vi.fn(async () =>
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
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(String(init.body));
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
    ).rejects.toBeInstanceOf(GoogleAuthError);

    try {
      await refreshAccessToken({
        clientId: 'cid',
        clientSecret: 'csecret',
        refreshToken: 'rt-revoked',
      });
    } catch (err) {
      expect(err).toMatchObject({ code: 'token_revoked' });
    }
  });
});
```

Create `packages/google/src/client.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/google/src/tokens.test.ts packages/google/src/client.test.ts`

Expected: FAIL — modules or exports not found.

- [ ] **Step 3: Write minimal implementation**

`packages/google/src/errors.ts`:

```ts
export type GoogleAuthErrorCode =
  | 'invalid_grant'
  | 'token_revoked'
  | 'missing_tokens'
  | 'refresh_failed';

export class GoogleAuthError extends Error {
  readonly code: GoogleAuthErrorCode;

  constructor(code: GoogleAuthErrorCode, message: string) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

export function isGoogleAuthError(err: unknown): err is GoogleAuthError {
  return err instanceof GoogleAuthError;
}
```

`packages/google/src/types.ts`:

```ts
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
```

`packages/google/src/tokens.ts`:

```ts
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
```

`packages/google/src/client.ts`:

```ts
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
    async listCalendars() {
      throw new Error('listCalendars not implemented');
    },
    async listEvents() {
      throw new Error('listEvents not implemented');
    },
    async fetchPhoto() {
      throw new Error('fetchPhoto not implemented');
    },
  };
}
```

Update `packages/google/src/index.ts` to export:

```ts
export const GOOGLE_PACKAGE_NAME = '@homeslate/google';
export { createGoogleClient } from './client';
export { GoogleAuthError, isGoogleAuthError } from './errors';
export type { GoogleAuthErrorCode } from './errors';
export { exchangeAuthorizationCode, refreshAccessToken } from './tokens';
export type { TokenGrant } from './tokens';
export type {
  CalendarEvent,
  CalendarListItem,
  GoogleBindingStore,
  GoogleClient,
  GoogleTokens,
  TokenStore,
} from './types';
```

`listCalendars` / `listEvents` / `fetchPhoto` throwing is intentional until Tasks 3 and 4. Do not add tests that call them yet.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/google/src/tokens.test.ts packages/google/src/client.test.ts packages/google/src/index.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/google
git commit -m "feat: add Google token client with TokenStore and GoogleAuthError"
```

---

### Task 3: Calendar List And Events

**Files:**
- Create: `packages/google/src/calendar.ts`
- Modify: `packages/google/src/client.ts`
- Modify: `packages/google/src/index.ts`
- Test: `packages/google/src/calendar.test.ts`

**Interfaces:**
- Consumes: `createGoogleClient`, `TokenStore`, `getAccessToken` from Task 2
- Produces:
  - `export function listCalendarsWithAccessToken(accessToken: string): Promise<CalendarListItem[]>`
  - `export function listEventsWithAccessToken(accessToken: string, params: { calendarIds: string[]; timeMin: string; timeMax: string; calendarList?: CalendarListItem[]; maxResults?: number }): Promise<CalendarEvent[]>`
  - `GoogleClient.listCalendars(accountId)` / `GoogleClient.listEvents(accountId, params)`
  - Skip `status === 'cancelled'` events; skip events missing start or end
  - `allDay` is true when `start.date` is set and `start.dateTime` is not
  - Default calendar color `#4285f4`; event `colorId` uses the same map as `netlify/functions/display-calendar.ts`
  - Per-calendar fetch failures are skipped (do not fail the whole list)
  - Events sorted by `start` ascending
  - `maxResults` default `100` (kiosk path)

- [ ] **Step 1: Write the failing tests**

Create `packages/google/src/calendar.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/google/src/calendar.test.ts`

Expected: FAIL — `./calendar` not found (or client methods still throw).

- [ ] **Step 3: Write minimal implementation**

`packages/google/src/calendar.ts`:

```ts
import type { CalendarEvent, CalendarListItem } from './types';

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const DEFAULT_CALENDAR_COLOR = '#4285f4';

const EVENT_COLORS: Record<string, string> = {
  '1': '#7986CB',
  '2': '#33B679',
  '3': '#8E24AA',
  '4': '#E67C73',
  '5': '#F6BF26',
  '6': '#F4511E',
  '7': '#039BE5',
  '8': '#3F51B5',
  '9': '#0F9D58',
  '10': '#D50000',
  '11': '#616161',
};

type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
  colorId?: string;
  htmlLink?: string;
  description?: string;
  location?: string;
};

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

function parseEvent(
  event: GoogleCalendarEvent,
  calendarId: string,
  calendarColor: string,
  calendarName?: string
): CalendarEvent | null {
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!start || !end) return null;
  const allDay = Boolean(event.start?.date) && !event.start?.dateTime;
  const color = event.colorId ? (EVENT_COLORS[event.colorId] ?? calendarColor) : calendarColor;
  return {
    id: event.id,
    calendarId,
    calendarName,
    title: event.summary ?? '(No title)',
    description: event.description,
    location: event.location,
    start,
    end,
    allDay,
    color,
    htmlLink: event.htmlLink,
  };
}

export async function listCalendarsWithAccessToken(
  accessToken: string
): Promise<CalendarListItem[]> {
  const res = await fetch(`${GOOGLE_API_BASE}/users/me/calendarList`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch calendar list: ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      backgroundColor?: string;
      description?: string;
      foregroundColor?: string;
      primary?: boolean;
      selected?: boolean;
    }>;
  };
  return (data.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? item.id,
    backgroundColor: item.backgroundColor,
    description: item.description,
    foregroundColor: item.foregroundColor,
    primary: item.primary,
    selected: item.selected,
  }));
}

export async function listEventsWithAccessToken(
  accessToken: string,
  params: {
    calendarIds: string[];
    timeMin: string;
    timeMax: string;
    calendarList?: CalendarListItem[];
    maxResults?: number;
  }
): Promise<CalendarEvent[]> {
  const calendars =
    params.calendarList ?? (await listCalendarsWithAccessToken(accessToken));
  const calendarMap = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const maxResults = String(params.maxResults ?? 100);
  const allEvents: CalendarEvent[] = [];

  for (const calendarId of params.calendarIds) {
    const cal = calendarMap.get(calendarId);
    const color = cal?.backgroundColor ?? DEFAULT_CALENDAR_COLOR;
    const query = new URLSearchParams({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      maxResults,
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    const res = await fetch(
      `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
      { headers: authHeaders(accessToken) }
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { items?: GoogleCalendarEvent[] };
    for (const event of data.items ?? []) {
      if (event.status === 'cancelled') continue;
      const parsed = parseEvent(event, calendarId, color, cal?.summary);
      if (parsed) allEvents.push(parsed);
    }
  }

  return allEvents.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}
```

In `packages/google/src/client.ts`, import the calendar helpers and replace the `listCalendars` / `listEvents` stubs:

```ts
import { listCalendarsWithAccessToken, listEventsWithAccessToken } from './calendar';
```

```ts
    async listCalendars(accountId: string) {
      const token = await getAccessToken(accountId);
      return listCalendarsWithAccessToken(token);
    },
    async listEvents(accountId, params) {
      const token = await getAccessToken(accountId);
      return listEventsWithAccessToken(token, params);
    },
```

Leave `fetchPhoto` throwing until Task 4.

Export the calendar helpers from `packages/google/src/index.ts`:

```ts
export { listCalendarsWithAccessToken, listEventsWithAccessToken } from './calendar';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/google/src/calendar.test.ts packages/google/src/client.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/google
git commit -m "feat: add Google calendar list and event helpers"
```

---

### Task 4: Photo Fetch Helper

**Files:**
- Create: `packages/google/src/photos.ts`
- Modify: `packages/google/src/client.ts`
- Modify: `packages/google/src/index.ts`
- Test: `packages/google/src/photos.test.ts`

**Interfaces:**
- Consumes: `createGoogleClient.getAccessToken` from Task 2
- Produces:
  - `export function fetchPhotoWithAccessToken(accessToken: string, params: { baseUrl: string; size: string }): Promise<Uint8Array>`
  - `GoogleClient.fetchPhoto(accountId, params)`
  - Allow only `https://lh<digits>.googleusercontent.com/...` and `https://photos.googleapis.com/...`
  - Fetch URL is `${baseUrl}=${size}` with `Authorization: Bearer <token>`
  - Reject other URLs with `Error('URL not allowed')` and do not `fetch`

- [ ] **Step 1: Write the failing tests**

Create `packages/google/src/photos.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/google/src/photos.test.ts`

Expected: FAIL — `./photos` not found (or `fetchPhoto` still throws).

- [ ] **Step 3: Write minimal implementation**

`packages/google/src/photos.ts`:

```ts
const ALLOWED_PHOTO_URL = /^https:\/\/(lh\d+\.googleusercontent\.com|photos\.googleapis\.com)\//;

export function assertAllowedPhotoUrl(baseUrl: string): void {
  if (!ALLOWED_PHOTO_URL.test(baseUrl)) {
    throw new Error('URL not allowed');
  }
}

export async function fetchPhotoWithAccessToken(
  accessToken: string,
  params: { baseUrl: string; size: string }
): Promise<Uint8Array> {
  assertAllowedPhotoUrl(params.baseUrl);
  const res = await fetch(`${params.baseUrl}=${params.size}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google Photos fetch failed: ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
```

In `packages/google/src/client.ts`, import `fetchPhotoWithAccessToken` and replace the stub:

```ts
    async fetchPhoto(accountId, params) {
      const token = await getAccessToken(accountId);
      return fetchPhotoWithAccessToken(token, params);
    },
```

Export from `packages/google/src/index.ts`:

```ts
export { fetchPhotoWithAccessToken } from './photos';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/google/src/photos.test.ts packages/google/src/client.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/google
git commit -m "feat: add Google Photos baseUrl fetch helper"
```

---

### Task 5: Thin Wrappers For exchange-code And refresh-token

**Files:**
- Create: `netlify/functions/_shared/googleClient.ts`
- Modify: `netlify/functions/exchange-code.ts`
- Modify: `netlify/functions/refresh-token.ts`
- Leave: `netlify/functions/_shared/googleTokens.ts` until Task 6 (display-calendar still imports it)

**Interfaces:**
- Consumes: `exchangeAuthorizationCode`, `refreshAccessToken` from Task 2
- Produces: hosted functions still return the same JSON; identity upsert and persist-by-refresh-token stay in the functions
- `googleOAuthCredentials()` reads `process.env.GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and throws `Missing Google OAuth credentials`

- [ ] **Step 1: Confirm current callers (no new handler test file)**

HTTP handlers are not unit-tested in this repo (they need Netlify + Neon). Do not add `googleClient.test.ts`. The contract for this task: after the edit, `exchange-code.ts` and `refresh-token.ts` must not import `./_shared/googleTokens`. `display-calendar.ts` still imports `exchangeRefreshToken` until Task 6.

Automated checks are the existing package tests plus `npx tsc -b --pretty false`.

- [ ] **Step 2: Implement hosted credential helper and switch the two functions**

Create `netlify/functions/_shared/googleClient.ts`:

```ts
import { createGoogleClient, type GoogleClient, type TokenStore } from '@homeslate/google';

export function googleOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth credentials');
  }
  return { clientId, clientSecret };
}

export function createHostedGoogleClient(tokenStore: TokenStore): GoogleClient {
  return createGoogleClient({ ...googleOAuthCredentials(), tokenStore });
}
```

In `netlify/functions/exchange-code.ts`:

- Remove `import { exchangeAuthCode } from './_shared/googleTokens';`
- Add `import { exchangeAuthorizationCode } from '@homeslate/google';`
- Add `import { googleOAuthCredentials } from './_shared/googleClient';`
- Replace `const tokenData = await exchangeAuthCode(code, redirectUri);` with:

```ts
    const { clientId, clientSecret } = googleOAuthCredentials();
    const grant = await exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
    const accessToken = grant.accessToken;
    const refreshToken = grant.refreshToken;
    const expiresIn = grant.expiresIn;
```

- Delete the old `const accessToken = tokenData.access_token;` / `tokenData.refresh_token` / `tokenData.expires_in` lines (replaced above).
- Keep `verifyGoogleToken`, userinfo fetch, user upsert, and display creation exactly as they are.
- Keep the JSON response fields `access_token`, `expires_in`, `refresh_token`, `user`.

In `netlify/functions/refresh-token.ts`:

- Remove `import { exchangeRefreshToken } from './_shared/googleTokens';`
- Add `import { refreshAccessToken } from '@homeslate/google';`
- Add `import { googleOAuthCredentials } from './_shared/googleClient';`
- Replace the `exchangeRefreshToken` call with:

```ts
    const { clientId, clientSecret } = googleOAuthCredentials();
    const grant = await refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken,
    });
    const tokenData = {
      access_token: grant.accessToken,
      expires_in: grant.expiresIn,
      refresh_token: grant.refreshToken,
    };
    const fields = userTokenPersistFields(tokenData);
```

Keep the existing SQL persist-by-matching-refresh-token and the JSON response shape (`access_token`, `expires_in`, optional `refresh_token`).

Leave `netlify/functions/_shared/googleTokens.ts` in place for `display-calendar.ts` (Task 6). Do not change its implementation yet.

- [ ] **Step 3: Verify**

Run: `npx vitest run packages/google/src src/services/displayCalendarAuth.test.ts src/widgets/googleCalendarError.test.ts`

Expected: PASS

Run: `npx tsc -b --pretty false`

Expected: exit 0. If `exchange-code.ts` still references `tokenData`, fix it.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/exchange-code.ts netlify/functions/refresh-token.ts netlify/functions/_shared/googleClient.ts
git commit -m "refactor: wrap Google token HTTP through @homeslate/google"
```

---

### Task 6: display-calendar Uses The Package; Delete googleTokens Shim

**Files:**
- Create: `netlify/functions/_shared/neonTokenStore.ts`
- Modify: `netlify/functions/display-calendar.ts`
- Modify: `src/services/displayCalendarAuth.ts` (only `classifyRefreshFailure` GoogleAuthError support)
- Modify: `src/services/displayCalendarAuth.test.ts`
- Delete: `netlify/functions/_shared/googleTokens.ts`

**Interfaces:**
- Consumes: `createHostedGoogleClient`, `listCalendarsWithAccessToken`, `listEventsWithAccessToken`, `isGoogleAuthError`, `TokenStore`
- Produces:
  - `createNeonTokenStore(db): TokenStore` where `accountId` is `users.id`
  - Collaborator pooling **stays** in `display-calendar` (owner then collaborators)
  - Response JSON unchanged: `{ events, calendars }` on success; same 404 `reason` values when possible
  - `putTokens` writes `refresh_token`, `access_token`, `access_token_expires_at`
  - `putTokens` must not blank `refresh_token` when the incoming `refreshToken` is empty
  - If `createHostedGoogleClient` throws (missing env), still fall back to an unexpired candidate access token (today’s behavior)

- [ ] **Step 1: Write the failing classifyRefreshFailure tests**

Add to `src/services/displayCalendarAuth.test.ts`:

```ts
import { GoogleAuthError } from '@homeslate/google';
```

Inside `describe('classifyRefreshFailure')`:

```ts
  it('reads GoogleAuthError codes', () => {
    expect(classifyRefreshFailure(new GoogleAuthError('invalid_grant', 'nope'))).toBe(
      'invalid_grant'
    );
    expect(classifyRefreshFailure(new GoogleAuthError('token_revoked', 'nope'))).toBe(
      'token_revoked'
    );
    expect(classifyRefreshFailure(new GoogleAuthError('missing_tokens', 'nope'))).toBe(
      'refresh_failed'
    );
  });
```

Update `RefreshFailureReason` only if needed. Map `missing_tokens` and unknown codes to `'refresh_failed'` so existing 404 reasons stay stable. Do **not** add `'missing_tokens'` to the hosted reason union unless you also update `display-calendar` 404 payloads (don’t).

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npx vitest run src/services/displayCalendarAuth.test.ts`

Expected: FAIL — `classifyRefreshFailure` does not understand `GoogleAuthError` (maps to `refresh_failed` via message, or `invalid_grant` only if the message contains that string). The `missing_tokens` case should fail because the message is `'nope'`.

- [ ] **Step 3: Implement TokenStore, classifyRefreshFailure, and display-calendar**

In `src/services/displayCalendarAuth.ts`, change `classifyRefreshFailure`:

```ts
import { isGoogleAuthError } from '@homeslate/google';
```

```ts
export function classifyRefreshFailure(err: unknown): RefreshFailureReason {
  if (isGoogleAuthError(err)) {
    if (err.code === 'invalid_grant' || err.code === 'token_revoked') return err.code;
    return 'refresh_failed';
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/Missing Google OAuth credentials/i.test(message)) return 'missing_oauth_credentials';
  if (/expired or revoked/i.test(message)) return 'token_revoked';
  if (/invalid_grant/i.test(message)) return 'invalid_grant';
  return 'refresh_failed';
}
```

Create `netlify/functions/_shared/neonTokenStore.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { TokenStore } from '@homeslate/google';
import { getDb, users } from '../../../src/db';

type Db = ReturnType<typeof getDb>;

export function createNeonTokenStore(db: Db): TokenStore {
  const store: TokenStore = {
    async getRefreshToken(accountId) {
      const tokens = await store.getTokens(accountId);
      return tokens?.refreshToken ? tokens.refreshToken : null;
    },
    async getTokens(accountId) {
      const [row] = await db
        .select({
          refreshToken: users.refreshToken,
          accessToken: users.accessToken,
          accessTokenExpiresAt: users.accessTokenExpiresAt,
        })
        .from(users)
        .where(eq(users.id, accountId))
        .limit(1);
      if (!row) return null;
      const refreshToken = row.refreshToken?.trim() ?? '';
      return {
        refreshToken,
        accessToken: row.accessToken ?? undefined,
        expiresAt: row.accessTokenExpiresAt ?? undefined,
      };
    },
    async putTokens(accountId, tokens) {
      const refresh = tokens.refreshToken.trim();
      await db
        .update(users)
        .set({
          accessToken: tokens.accessToken ?? null,
          accessTokenExpiresAt: tokens.expiresAt ?? null,
          ...(refresh ? { refreshToken: refresh } : {}),
        })
        .where(eq(users.id, accountId));
    },
    async deleteTokens(accountId) {
      await db
        .update(users)
        .set({
          refreshToken: null,
          accessToken: null,
          accessTokenExpiresAt: null,
        })
        .where(eq(users.id, accountId));
    },
  };
  return store;
}
```

Rewrite `netlify/functions/display-calendar.ts` calendar HTTP as follows. Keep CORS, query-param parsing, owner/collaborator SELECTs, `normalizeTokenRow`, `summarizeTokenCandidates`, logging, and 404 payload shape.

Remove:

- `import { exchangeRefreshToken } from './_shared/googleTokens';`
- `GOOGLE_API_BASE`
- `GoogleCalendarEvent`, `ParsedEvent`, `EVENT_COLORS`, `parseEvent`
- `exchangeRefreshForAccess`
- `persistRefreshedTokens`
- the calendarList + per-calendar events fetch block that uses raw `fetch`

Add:

```ts
import {
  isGoogleAuthError,
  listCalendarsWithAccessToken,
  listEventsWithAccessToken,
  type CalendarEvent,
  type CalendarListItem,
} from '@homeslate/google';
import { createHostedGoogleClient } from './_shared/googleClient';
import { createNeonTokenStore } from './_shared/neonTokenStore';
```

Replace the token-selection + Google fetch section (from `let token: string | null = null` through building `calendarsForClient`) with:

```ts
    const refreshFailures: Array<{ source: TokenCandidate['source']; reason: string; error: string }> = [];
    const tokenStore = createNeonTokenStore(db);
    let client: ReturnType<typeof createHostedGoogleClient> | null = null;
    try {
      client = createHostedGoogleClient(tokenStore);
    } catch (err) {
      console.warn(`${LOG_PREFIX} google client unavailable`, { error: errorMessage(err) });
      refreshFailures.push({
        source: 'owner',
        reason: classifyRefreshFailure(err),
        error: errorMessage(err),
      });
    }

    let token: string | null = null;
    let chosenSource: TokenCandidate['source'] | null = null;

    for (const candidate of tokenCandidates) {
      if (client) {
        try {
          token = await client.getAccessToken(candidate.user_id);
          chosenSource = candidate.source;
          console.info(`${LOG_PREFIX} token selected via client`, {
            displayId,
            source: candidate.source,
          });
          break;
        } catch (err) {
          const reason = classifyRefreshFailure(err);
          const error = errorMessage(err);
          console.error(`${LOG_PREFIX} refresh failed`, {
            displayId,
            source: candidate.source,
            reason,
            error,
            googleAuth: isGoogleAuthError(err) ? err.code : undefined,
          });
          refreshFailures.push({ source: candidate.source, reason, error });
        }
      }

      if (!token && candidate.access_token && isAccessTokenUnexpired(candidate.access_token_expires_at, Date.now())) {
        token = candidate.access_token;
        chosenSource = candidate.source;
        console.info(`${LOG_PREFIX} using unexpired access token fallback`, {
          displayId,
          source: candidate.source,
        });
        break;
      }
    }

    if (!token) {
      const reason = refreshFailures[0]?.reason
        ?? (tokenSummary.ownerCandidates === 0 ? 'display_not_found' : 'no_usable_token');
      const details = {
        ...tokenSummary,
        refreshFailures,
      };
      console.warn(`${LOG_PREFIX} no usable token`, { displayId, reason, ...details });
      return json(404, {
        error: isFatalGoogleAuthFailure(reason)
          ? DISPLAY_GOOGLE_RECONNECT_MESSAGE
          : 'A display owner or linked collaborator needs to sign in from the management app to refresh calendar access',
        reason,
        details,
      });
    }

    console.info(`${LOG_PREFIX} token selected`, { displayId, source: chosenSource });

    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const timeMax = new Date(timeMin.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    let calendars: CalendarListItem[];
    try {
      calendars = await listCalendarsWithAccessToken(token);
    } catch (err) {
      console.error(`${LOG_PREFIX} calendar list failed`, {
        displayId,
        error: errorMessage(err),
      });
      return json(502, {
        error: 'Failed to fetch calendar list',
        reason: 'calendar_list_failed',
      });
    }

    const allEvents: CalendarEvent[] = await listEventsWithAccessToken(token, {
      calendarIds,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      calendarList: calendars,
    });

    const calendarMap = new Map(calendars.map((calendar) => [calendar.id, calendar]));
    const calendarsForClient = calendarIds.map((id) => {
      const c = calendarMap.get(id);
      return { id, summary: c?.summary ?? id, backgroundColor: c?.backgroundColor };
    });
```

Keep the success `json(200, { events: allEvents, calendars: calendarsForClient })` and the outer `catch` 500.

Delete `netlify/functions/_shared/googleTokens.ts`. Grep the repo for `googleTokens` and `_shared/googleTokens`; there must be zero imports left.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/services/displayCalendarAuth.test.ts packages/google/src src/widgets/googleCalendarError.test.ts`

Expected: PASS

Run: `npx tsc -b --pretty false`

Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/display-calendar.ts netlify/functions/_shared/neonTokenStore.ts netlify/functions/_shared/googleClient.ts src/services/displayCalendarAuth.ts src/services/displayCalendarAuth.test.ts
git rm netlify/functions/_shared/googleTokens.ts
git commit -m "refactor: drive kiosk calendar reads through @homeslate/google"
```

---

### Task 7: photo-store Uses fetchPhotoWithAccessToken

**Files:**
- Modify: `netlify/functions/photo-store.ts`

**Interfaces:**
- Consumes: `fetchPhotoWithAccessToken` from Task 4
- Produces: same POST contract (`{ key }`); Netlify Blobs persistence unchanged; bearer `tokeninfo` check unchanged
- Catch `URL not allowed` and return 400 `{ error: 'URL not allowed' }`
- Catch `Google Photos fetch failed: <status>` and return that status with the existing error JSON

- [ ] **Step 1: Identify the fetch block to replace**

In `netlify/functions/photo-store.ts`, the allowlist regex, `fetchUrl`, and `imgRes.arrayBuffer()` block are the Google-fetch portion. Blobs idempotency and `connectLambda` stay.

There is no existing photo-store unit test. Verification is typecheck + package photo tests already passing.

- [ ] **Step 2: Confirm package tests still pass (baseline)**

Run: `npx vitest run packages/google/src/photos.test.ts`

Expected: PASS

- [ ] **Step 3: Replace Google fetch with the package helper**

At the top of `photo-store.ts`, add:

```ts
import { fetchPhotoWithAccessToken } from '@homeslate/google';
```

Delete the local `allowed` regex and the `fetchUrl` / `imgRes` block. After computing `key` and returning early if the blob exists, replace the Google fetch with:

```ts
  let bytes: Uint8Array;
  try {
    bytes = await fetchPhotoWithAccessToken(accessToken, { baseUrl, size });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'URL not allowed') {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: 'URL not allowed' }),
      };
    }
    const failed = /^Google Photos fetch failed: (\d+)$/.exec(message);
    if (failed) {
      const status = Number(failed[1]);
      return {
        statusCode: status,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: `Google Photos fetch failed: ${status}` }),
      };
    }
    throw err;
  }

  const contentType = 'image/jpeg';
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
```

`store.set` currently receives `arrayBuffer` from `imgRes.arrayBuffer()`. Pass `arrayBuffer` as above, or pass `bytes` if the Blobs client accepts `Uint8Array` (it accepts `ArrayBuffer` today — keep `ArrayBuffer`).

Keep the existing blob metadata `{ contentType }`. The previous code used Google’s `content-type` header. Defaulting to `image/jpeg` is acceptable; if you still want the header, change `fetchPhotoWithAccessToken` in this same task to return `{ bytes: Uint8Array; contentType: string }` and update `packages/google/src/photos.test.ts` accordingly. Prefer **not** changing the package return type (spec is `Promise<Uint8Array>`). Use `image/jpeg` as the stored content type.

Keep `verifyToken` (identity) local or switch it to `verifyGoogleToken` from `./_shared/googleAuth` — optional cleanup; do not expand scope if the local helper stays.

- [ ] **Step 4: Verify**

Run: `npx vitest run packages/google/src`

Expected: PASS

Run: `npx tsc -b --pretty false`

Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/photo-store.ts
git commit -m "refactor: fetch Google Photos bytes through @homeslate/google"
```

---

## Self-review

**Spec coverage**

| Spec item | Task |
|---|---|
| `TokenStore` + `GoogleTokens` | 2 |
| `GoogleBindingStore` type exported (no hosted impl) | 2 |
| `createGoogleClient` + `exchangeAuthCode` + `getAccessToken` | 2 |
| `listCalendars` / `listEvents` + shared event shapes | 3 |
| `fetchPhoto` | 4 |
| Package does not bind HTTP/Postgres/identity | 2–4 (enforced by package files) |
| `invalid_grant` → `GoogleAuthError` | 2, 6 |
| Missing GCP env → throw at client construction | 2, 5 |
| Netlify functions become thin wrappers | 5, 6, 7 |
| Collaborator pooling stays hosted | 6 |
| Identity stays hosted (`googleAuth.ts`) | unchanged |
| GIS / picker / event CRUD stay in `src/services` | unchanged |
| File/sqlite `TokenStore` | Phase 5, not this plan |

**Placeholder scan:** none of TBD / “add tests for the above” / “similar to Task N” remain as instructions without code.

**Type consistency:** `GoogleClient` methods in Task 2 stubs are filled in Tasks 3–4 with the same signatures declared in `types.ts`. Hosted `accountId` is `users.id`. `CalendarEvent.start`/`end` are strings.

**Intentional hosted extras (not in the spec client, required to carve without rewriting login):** `exchangeAuthorizationCode`, `refreshAccessToken`, `listCalendarsWithAccessToken`, `listEventsWithAccessToken`, `fetchPhotoWithAccessToken`.
