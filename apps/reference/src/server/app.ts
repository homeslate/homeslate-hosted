import {
  DisplayNotFoundError,
  FileTokenStore,
  InvalidDisplayDocumentError,
  SqliteDisplayStore,
  SqliteGoogleBindingStore,
  assertValidDisplayDocument,
  createEmptyDisplayDocument,
  openSqlite,
} from '@homeslate/adapters';
import {
  createGoogleClient,
  isGoogleAuthError,
  type GoogleClient,
} from '@homeslate/google';
import {
  DISPLAY_GOOGLE_RECONNECT_MESSAGE,
  DISPLAY_OWNER_SIGN_IN_MESSAGE,
} from '@homeslate/widgets';
import { Hono, type Context } from 'hono';
import {
  DEFAULT_REFERENCE_PUBLIC_BASE_URL,
  googleAuthorizationUrl,
  googleRedirectUri,
} from './google';
import { referenceDatabasePath, referenceTokensPath } from './paths';

export const REFERENCE_LOCAL_ACCOUNT_ID = 'local';

export type ReferenceAppOptions = {
  dataDir: string;
  googleClientId?: string;
  googleClientSecret?: string;
  publicBaseUrl?: string;
};

export function createReferenceApp(opts: ReferenceAppOptions): Hono {
  const database = openSqlite(referenceDatabasePath(opts.dataDir));
  const displays = new SqliteDisplayStore({ database });
  const bindings = new SqliteGoogleBindingStore({ database });
  const tokenStore = new FileTokenStore({ dir: referenceTokensPath(opts.dataDir) });
  const googleClientId = opts.googleClientId?.trim() ?? '';
  const googleClientSecret = opts.googleClientSecret?.trim() ?? '';
  const publicBaseUrl = opts.publicBaseUrl ?? DEFAULT_REFERENCE_PUBLIC_BASE_URL;
  const redirectUri = googleRedirectUri(publicBaseUrl);
  const google: GoogleClient | null =
    googleClientId && googleClientSecret
      ? createGoogleClient({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          tokenStore,
        })
      : null;
  const app = new Hono();

  app.get('/api/displays', async (c) => c.json(await displays.list()));

  app.post('/api/displays', async (c) => {
    try {
      const rawBody = await optionalJsonBody(c.req.raw);
      const document = assertValidDisplayDocument(
        rawBody.document ?? createEmptyDisplayDocument(),
      );
      const record = await displays.create(document);
      await bindings.setAccountIdForDisplay(record.id, REFERENCE_LOCAL_ACCOUNT_ID);
      return c.json(record, 201);
    } catch (error) {
      if (error instanceof InvalidDisplayDocumentError) {
        return c.json({ errors: error.errors }, 400);
      }
      if (error instanceof SyntaxError) {
        return c.json({ error: 'Invalid JSON' }, 400);
      }
      throw error;
    }
  });

  app.get('/api/displays/:id', async (c) => {
    const record = await displays.get(c.req.param('id'));
    return record ? c.json(record) : c.json({ error: 'Display not found' }, 404);
  });

  app.put('/api/displays/:id', async (c) => {
    try {
      const document = assertValidDisplayDocument(await c.req.json());
      await displays.put(c.req.param('id'), document);
      const record = await displays.get(c.req.param('id'));
      return c.json(record);
    } catch (error) {
      return documentWriteError(c, error);
    }
  });

  app.delete('/api/displays/:id', async (c) => {
    await displays.remove(c.req.param('id'));
    return c.json({ ok: true });
  });

  app.get('/api/public/:publicId', async (c) => {
    const record = await displays.getByPublicId(c.req.param('publicId'));
    return record
      ? c.json({ document: record.document })
      : c.json({ error: 'Display not found' }, 404);
  });

  app.put('/api/public/:publicId', async (c) => {
    const record = await displays.getByPublicId(c.req.param('publicId'));
    if (!record) return c.json({ error: 'Display not found' }, 404);

    try {
      const document = assertValidDisplayDocument(await c.req.json());
      await displays.put(record.id, document);
      return c.json({ document });
    } catch (error) {
      return documentWriteError(c, error);
    }
  });

  app.get('/api/display-calendar', async (c) => {
    const publicId = c.req.query('displayId');
    const calendarIdsParam = c.req.query('calendarIds');
    const daysAhead = Math.min(
      90,
      Math.max(1, parseInt(c.req.query('daysAhead') ?? '30', 10) || 30),
    );

    if (!publicId || !calendarIdsParam) {
      return c.json(
        { error: 'Missing displayId or calendarIds', reason: 'missing_params' },
        400,
      );
    }

    const record = await displays.getByPublicId(publicId);
    if (!record) return c.json({ error: 'Display not found' }, 404);

    const calendarIds = calendarIdsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (calendarIds.length === 0) return c.json({ events: [], calendars: [] });

    const accountId = await bindings.getAccountIdForDisplay(record.id);
    if (!google || !accountId) return c.json(emptyCalendarPayload());

    try {
      const now = new Date();
      const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      const calendars = await google.listCalendars(accountId);
      const events = await google.listEvents(accountId, {
        calendarIds,
        timeMin: now.toISOString(),
        timeMax: timeMax.toISOString(),
      });
      return c.json({ events, calendars });
    } catch (error) {
      if (isGoogleAuthError(error)) {
        if (error.code === 'missing_tokens') return c.json(emptyCalendarPayload());
        if (error.code === 'invalid_grant' || error.code === 'token_revoked') {
          return c.json(
            { error: DISPLAY_GOOGLE_RECONNECT_MESSAGE, reason: error.code },
            401,
          );
        }
        return c.json({ error: error.message, reason: error.code }, 502);
      }
      return c.json({ error: errorMessage(error) }, 502);
    }
  });

  app.get('/api/google/connect', (c) => {
    if (!google) return c.json({ error: 'Google OAuth is not configured' }, 404);
    return c.redirect(googleAuthorizationUrl(googleClientId, redirectUri));
  });

  app.get('/api/google/callback', async (c) => {
    if (!google) return c.json({ error: 'Google OAuth is not configured' }, 404);
    const code = c.req.query('code');
    if (!code) return c.json({ error: 'Missing code' }, 400);
    await google.exchangeAuthCode(REFERENCE_LOCAL_ACCOUNT_ID, code, redirectUri);
    return c.redirect('/');
  });

  app.get('/api/google/session', async (c) => {
    if (!google) return c.json({ accessToken: null });
    try {
      const accessToken = await google.getAccessToken(REFERENCE_LOCAL_ACCOUNT_ID);
      return c.json({ accessToken });
    } catch {
      return c.json({ accessToken: null });
    }
  });

  return app;
}

async function optionalJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.text();
  if (!body) return {};
  const value: unknown = JSON.parse(body);
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
}

function documentWriteError(
  c: Context,
  error: unknown,
) {
  if (error instanceof InvalidDisplayDocumentError) {
    return c.json({ errors: error.errors }, 400);
  }
  if (error instanceof DisplayNotFoundError) {
    return c.json({ error: 'Display not found' }, 404);
  }
  throw error;
}

function emptyCalendarPayload() {
  return {
    events: [],
    calendars: [],
    error: DISPLAY_OWNER_SIGN_IN_MESSAGE,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
