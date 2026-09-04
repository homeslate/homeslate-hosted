# Homeslate (Hosted)

Private hosted product — Netlify app, Neon Postgres, Google sign-in, and Stripe billing.

> **Repos:** Widget/editor/display packages live in the public [homeslate/homeslate](https://github.com/homeslate/homeslate) repo (npm: `@homeslate/*`). This repo is the private [homeslate-hosted](https://github.com/homeslate/homeslate-hosted) deploy.

Homeslate is a household display platform: create **displays**, build **views** with drag-and-drop widgets, and run them fullscreen on wall tablets.

## Prerequisites

- **Node.js 24+** (see `.nvmrc`; CI and Netlify use Node 24)
- npm
- Copy `.env.example` → `.env.local` and fill in Google OAuth + `DATABASE_URL`

## Local development

```bash
npm install

# Frontend only (Vite on :5173 — /api/* will not work)
npm run dev

# Full stack: Vite + Netlify functions on :8888 (recommended)
npm run dev:netlify
```

Open **http://localhost:8888** when using `dev:netlify`.

### Quality checks

```bash
npm run test:run   # unit tests
npm run build      # typecheck + Vite production build
npm run lint
```

GitHub Actions runs the same checks on every PR (see `.github/workflows/ci.yml`).

## Project structure

```
apps/hosted/                 # Vite React app (management UI + wall viewer)
  src/                       # pages, billing, auth, store
  netlify/functions/         # serverless API (displays, config, billing, …)
drizzle/                     # schema + migrations (Neon Postgres)
public/                      # static assets (icons, PWA)
scripts/                     # redirects, db-migrate-prod, postinstall patches
dist/                        # build output (Netlify publish dir)
netlify.toml                 # build, functions, redirects, headers
```

UI widgets and the editor live in **`@homeslate/*`** on npm — not in this repo. To change widget code, work in [homeslate/homeslate](https://github.com/homeslate/homeslate) and publish a new package version.

## Database (Neon + Drizzle)

| Environment | `DATABASE_URL` source |
|---|---|
| Local dev | Neon **dev** branch in `.env.local` |
| Netlify production | Neon **prod** branch in Netlify env vars |
| Deploy previews | Optional separate branch |

```bash
npm run db:migrate:dev          # apply migrations to dev (uses DATABASE_URL)
npm run db:migrate:prod         # apply to prod (uses DATABASE_URL_PROD in .env.local)
npm run db:generate             # create migration after schema changes
```

**Promote flow:** develop on dev → `db:generate` → `db:migrate:dev` → deploy app → `db:migrate:prod`.

Prefer `db:migrate` over `db:push` in production. Never commit credentials.

## Deployment (Netlify)

Production site: **https://homeslate.dev**

Netlify reads `netlify.toml`:

- **Build:** `npm run build -w homeslate-hosted && node scripts/write-redirects.mjs`
- **Publish:** `dist/`
- **Functions:** `apps/hosted/netlify/functions/`
- **Node:** 24 (pinned in `[build.environment]`)

### Required Netlify environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | Functions | Neon prod connection |
| `GOOGLE_CLIENT_ID` | Functions | Token verification |
| `GOOGLE_CLIENT_SECRET` | Functions | OAuth + refresh |
| `VITE_GOOGLE_CLIENT_ID` | Build | Sign-in button |
| Stripe / billing vars | Functions + build | See billing setup doc below |
| `SENTRY_DSN` | Functions | Optional error monitoring |
| `VITE_SENTRY_DSN` | Build | Same DSN for client errors (optional) |

After changing **`VITE_*`** vars, trigger a new deploy (they are build-time only).

### Post-deploy checklist

1. `npm run db:migrate:prod` if migrations changed
2. Confirm sign-in works (`/api/exchange-code` returns 401, not 502/404)
3. If billing enabled: webhook returns 400 on unsigned POST, not 404 — see [Stripe setup](docs/superpowers/specs/2026-09-03-hosted-billing-stripe-setup.md)

## Operator docs

| Doc | When |
|---|---|
| [Google Calendar OAuth](docs/GOOGLE_CALENDAR_SETUP.md) | First-time Google Cloud setup |
| [Stripe billing setup](docs/superpowers/specs/2026-09-03-hosted-billing-stripe-setup.md) | Enable Pro subscriptions (sandbox or live) |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Widget config persistence patterns |

## Widget setup (user-facing)

- **Weather** — no API key (Open-Meteo)
- **Calendar (iCal)** — paste an ICS URL
- **Google Calendar / Photos** — [OAuth setup guide](docs/GOOGLE_CALENDAR_SETUP.md)
- **News** — RSS feeds
- **Stocks** — Finnhub API key in widget settings

## Tech stack

- React 19, Vite 7, TypeScript, Mantine 8
- Netlify Functions, Neon Postgres, Drizzle ORM
- Google Identity Services, Stripe Checkout + Portal
- PWA (service worker) for wall displays

## License

Private — not open source. OSS packages are MIT-licensed in [homeslate/homeslate](https://github.com/homeslate/homeslate).
