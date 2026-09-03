import { mkdir, writeFile } from 'node:fs/promises'

// _redirects is processed before netlify.toml, so /api/* must come before the
// SPA catch-all — otherwise API routes return index.html instead of JSON.
await mkdir('dist', { recursive: true })
await writeFile(
  'dist/_redirects',
  [
    '/api/billing/checkout  /.netlify/functions/billing-checkout  200',
    '/api/billing/portal    /.netlify/functions/billing-portal    200',
    '/api/billing/webhook   /.netlify/functions/billing-webhook   200',
    '/api/*  /.netlify/functions/:splat  200',
    '/*    /index.html  200',
    '',
  ].join('\n'),
)
// GIS popup OAuth needs same-origin-allow-popups on static HTML (belt-and-suspenders
// alongside netlify.toml [[headers]] — ensures COOP even if toml headers are skipped).
await writeFile(
  'dist/_headers',
  ['/*', '  Cross-Origin-Opener-Policy: same-origin-allow-popups', ''].join('\n'),
)
