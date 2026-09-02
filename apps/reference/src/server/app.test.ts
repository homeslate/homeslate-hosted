import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyDisplayDocument } from '@homeslate/adapters';
import { DISPLAY_OWNER_SIGN_IN_MESSAGE } from '@homeslate/widgets';
import { createReferenceApp } from './app';

describe('createReferenceApp', () => {
  let dataDir = '';
  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  async function app() {
    dataDir = await mkdtemp(join(tmpdir(), 'homeslate-ref-'));
    return createReferenceApp({ dataDir });
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
});
