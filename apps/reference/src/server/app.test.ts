import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyDisplayDocument } from '@homeslate/adapters';
import { DISPLAY_OWNER_SIGN_IN_MESSAGE } from '@homeslate/widgets/server';
import { createReferenceApp } from './app';

const execFileAsync = promisify(execFile);

describe('createReferenceApp', () => {
  let dataDir = '';
  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  async function app() {
    dataDir = await mkdtemp(join(tmpdir(), 'homeslate-ref-'));
    return createReferenceApp({ dataDir });
  }

  async function googleApp() {
    dataDir = await mkdtemp(join(tmpdir(), 'homeslate-ref-'));
    return createReferenceApp({
      dataDir,
      googleClientId: 'client-id',
      googleClientSecret: 'client-secret',
    });
  }

  it('creates a fixture display and returns it from GET /api/displays', async () => {
    const hono = await app();
    const created = await hono.request('/api/displays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: createEmptyDisplayDocument('Kitchen') }),
    });
    expect(created.status).toBe(201);
    const record = await created.json() as { id: string; publicId: string; document: { name: string } };
    expect(record.document.name).toBe('Kitchen');

    const list = await hono.request('/api/displays');
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([{ id: record.id, name: 'Kitchen' }]);

    const kiosk = await hono.request(`/api/public/${record.publicId}`);
    expect(kiosk.status).toBe(200);
    expect((await kiosk.json() as { document: { name: string } }).document.name).toBe('Kitchen');
  });

  it('PUT invalid document returns 400 and leaves the store unchanged', async () => {
    const hono = await app();
    const created = await hono.request('/api/displays', { method: 'POST' });
    const record = await created.json() as { id: string; document: { name: string } };
    const put = await hono.request(`/api/displays/${record.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, name: 'x', views: 'nope' }),
    });
    expect(put.status).toBe(400);
    const again = await hono.request(`/api/displays/${record.id}`);
    expect((await again.json() as { document: { name: string } }).document.name).toBe(record.document.name);
  });

  it('PUT with malformed JSON returns 400 on both document routes', async () => {
    const hono = await app();
    const created = await hono.request('/api/displays', { method: 'POST' });
    const record = await created.json() as { id: string; publicId: string };

    const owner = await hono.request(`/api/displays/${record.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"schemaVersion":',
    });
    expect(owner.status).toBe(400);
    expect(await owner.json()).toEqual({ error: 'Invalid JSON' });

    const kiosk = await hono.request(`/api/public/${record.publicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all',
    });
    expect(kiosk.status).toBe(400);
    expect(await kiosk.json()).toEqual({ error: 'Invalid JSON' });
  });

  it('OAuth connect issues a state in both the redirect and an httpOnly cookie', async () => {
    const hono = await googleApp();
    const connect = await hono.request('/api/google/connect');
    expect(connect.status).toBe(302);

    const location = new URL(connect.headers.get('location') ?? '');
    const state = location.searchParams.get('state');
    expect(state).toEqual(expect.any(String));
    expect(state).not.toBe('');

    const cookie = connect.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`homeslate_oauth_state=${state}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('OAuth callback rejects a missing or mismatched state before exchanging a code', async () => {
    const hono = await googleApp();

    const noState = await hono.request('/api/google/callback?code=abc');
    expect(noState.status).toBe(400);
    expect(await noState.json()).toMatchObject({ reason: 'state_mismatch' });

    const connect = await hono.request('/api/google/connect');
    const cookie = (connect.headers.get('set-cookie') ?? '').split(';')[0];
    const mismatched = await hono.request('/api/google/callback?code=abc&state=forged', {
      headers: { cookie },
    });
    expect(mismatched.status).toBe(400);
    expect(await mismatched.json()).toMatchObject({ reason: 'state_mismatch' });
  });

  it('OAuth callback reports a Google error param instead of blaming a missing code', async () => {
    const hono = await googleApp();
    const connect = await hono.request('/api/google/connect');
    const cookie = (connect.headers.get('set-cookie') ?? '').split(';')[0];

    const denied = await hono.request('/api/google/callback?error=access_denied', {
      headers: { cookie },
    });
    expect(denied.status).toBe(400);
    const body = await denied.json() as { error: string; reason: string };
    expect(body.reason).toBe('access_denied');
    expect(body.error).toContain('access_denied');
    expect(body.error).not.toMatch(/missing code/i);
  });

  it('OAuth callback with a matching state still requires a code', async () => {
    const hono = await googleApp();
    const connect = await hono.request('/api/google/connect');
    const setCookie = connect.headers.get('set-cookie') ?? '';
    const cookie = setCookie.split(';')[0];
    const state = new URL(connect.headers.get('location') ?? '').searchParams.get('state');

    const missingCode = await hono.request(`/api/google/callback?state=${state}`, {
      headers: { cookie },
    });
    expect(missingCode.status).toBe(400);
    expect(await missingCode.json()).toMatchObject({ reason: 'missing_code' });
  });

  it('display-calendar without Google still returns the empty widget payload', async () => {
    const hono = await app();
    const created = await hono.request('/api/displays', { method: 'POST' });
    const record = await created.json() as { publicId: string };
    const cal = await hono.request(
      `/api/display-calendar?displayId=${record.publicId}&calendarIds=primary&daysAhead=7`,
    );
    expect(cal.status).toBe(200);
    const body = await cal.json() as { events: unknown[]; calendars: unknown[]; error: string };
    expect(body.events).toEqual([]);
    expect(body.calendars).toEqual([]);
    expect(body.error).toBe(DISPLAY_OWNER_SIGN_IN_MESSAGE);
  });

  it('loads in the Node tsx runtime used by the reference server', async () => {
    await expect(execFileAsync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        "await import('./apps/reference/src/server/app.ts')",
      ],
      { cwd: process.cwd() },
    )).resolves.toBeDefined();
  });
});
