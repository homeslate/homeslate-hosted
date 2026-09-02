# Homeslate reference host

Clone-and-run editor + kiosk for a single local machine. Requires **Node 22.13+**.

There are no accounts, Stripe, or quotas. Persistence is a sqlite file under `apps/reference/data`.

## Run

From the repository root:

```bash
npm install
```

Then start the API and Vite UI in two terminals:

```bash
npx tsx apps/reference/src/server/listen.ts
```

```bash
npx vite --config apps/reference/vite.config.ts
```

Workspace scripts (same split):

```bash
npm run dev:reference
npm run dev:web -w homeslate-reference
```

Open [http://127.0.0.1:5174](http://127.0.0.1:5174). Vite proxies `/api` to the Hono server on port 8787.

This is a development setup: the Hono server serves `/api` only, and Vite serves the UI. There is no production `vite build` + static-serving mode yet.

## Typecheck

The reference app builds on its own tsconfig solution (Node libs for `src/server`, DOM libs for `src/web`) and is deliberately outside the hosted `npm run build`:

```bash
npm run typecheck:reference
```

## Optional Google Calendar

Set these in the API process if you want calendar widgets to sign in:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

The OAuth callback is `http://127.0.0.1:5174/api/google/callback` (Vite proxies `/api` to the Hono server). Without these variables the editor and kiosk still run; calendar widgets stay empty.
