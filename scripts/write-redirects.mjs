import { mkdir, writeFile } from 'node:fs/promises'

// _redirects is processed before netlify.toml, so /api/* must come before the
// SPA catch-all — otherwise API routes return index.html instead of JSON.
await mkdir('dist', { recursive: true })
await writeFile(
  'dist/_redirects',
  ['/api/*  /.netlify/functions/:splat  200', '/*    /index.html  200', ''].join('\n'),
)
