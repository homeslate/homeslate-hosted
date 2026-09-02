import { serve } from '@hono/node-server';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createReferenceApp } from './app';

const dataDir = fileURLToPath(new URL('../../data', import.meta.url));

const app = createReferenceApp({
  dataDir,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

const listed = await app.request('/api/displays');
const displays = (await listed.json()) as unknown[];
if (Array.isArray(displays) && displays.length === 0) {
  await app.request('/api/displays', { method: 'POST' });
}

serve({ fetch: app.fetch, port: 8787 }, (info) => {
  console.log(`Reference API listening on http://127.0.0.1:${info.port}`);
});
