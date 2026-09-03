# OSS / Hosted Split — Phase 6b & 6c: OSS extract, npm publish, repo renames

## Status
Proposed. Awaiting human review before implementation.

## Prerequisites
- Phase 6a complete (`apps/hosted` carve merged to `main`).
- `@homeslate/*` packages and `apps/reference` still live in this monorepo.
- Hosted resolves packages via workspace path aliases (`vite.config.ts`, `tsconfig.app.json`, `vitest.config.ts`).

## Goal
End with two repositories and a real npm dependency boundary:

| Final repo name | Visibility | Contents |
|---|---|---|
| `homeslate` | Public (MIT) | `packages/*`, `apps/reference`, OSS docs/tests/CI |
| `homeslate-hosted` | Private | `apps/hosted`, `drizzle/`, `netlify.toml`, `public/`, Neon/Netlify secrets |

## Non-goals
- Entitlements / Stripe wiring (still deferred).
- Renaming `layouts` → `views` in hosted UI state.
- Making the hosted repo public.
- Publishing 1.0 — initial npm releases are pre-1.0 (`0.1.x`).

## Chosen sequence

```
Phase 6b — technical split
  1. Create temporary repo `homeslate-oss`
  2. Move OSS surface there (packages + reference + OSS tooling)
  3. Add per-package build + publish pipeline
  4. Publish @homeslate/* to npm
  5. Switch this repo (hosted) from workspace/path aliases → npm versions
  6. Delete local packages/* and apps/reference from this repo

Phase 6c — cosmetic renames (after 6b is green in production)
  7. Rename this repo `homeslate` → `homeslate-hosted`
  8. Rename `homeslate-oss` → `homeslate`
  9. Update repository URLs in package manifests and docs
```

Renames happen **last** so Netlify stays on the same GitHub repo through the risky dependency cutover.

## npm strategy

### Scope and org
- Publish under **`@homeslate/*`** on npmjs.com.
- Claim/create the `@homeslate` npm org before first publish.
- Initial version: **`0.1.0`** for all six packages (lockstep until Changesets is added).

### Build output
Packages currently export TypeScript source (`.ts`). npm consumers need compiled ESM + `.d.ts`:

- Add **`tsup`** (or equivalent) per package.
- Publish only `dist/` (`files: ["dist"]`).
- Preserve subpath exports:
  - `@homeslate/widgets/schemas`
  - `@homeslate/widgets/server`
  - `@homeslate/display/canvas`

### Publish order (dependency graph)
1. `@homeslate/schema`
2. `@homeslate/google`
3. `@homeslate/widgets`
4. `@homeslate/display`
5. `@homeslate/editor`
6. `@homeslate/adapters`

### CI (homeslate-oss)
- On push to `main`: `npm test`, `npm run build -ws --if-present`.
- On git tag `v*` (or manual workflow dispatch): publish all packages with `NPM_TOKEN`.

## Transitional duplication window
After OSS files land in `homeslate-oss` but before the hosted npm switch:

- **Keep** `packages/*` in this repo temporarily so hosted keeps working.
- **Do not** edit both copies in parallel — treat `homeslate-oss` as the publish source of truth; hosted copy is read-only until deletion.
- Target **≤ 1 week** between first npm publish and deleting local packages here.

## Hosted repo changes (Phase 6b step 5)
- Add semver deps on `@homeslate/*` to root `package.json` (shared by hosted UI + Netlify functions).
- Remove path aliases from:
  - `apps/hosted/vite.config.ts`
  - `tsconfig.app.json`
  - `vitest.config.ts`
- Fix the one deep import in `apps/hosted/netlify/functions/display-calendar.ts` — use `@homeslate/widgets` instead of `../../../../packages/widgets/...`.
- Remove stale duplicate `netlify/functions/**` at repo root (leftover from pre-6a; `netlify.toml` already points at `apps/hosted/netlify/functions`).
- Drop `packages/*` and `apps/reference` from workspaces.
- Move package/reference tests out with OSS — hosted `vitest` runs hosted tests only.

## Success criteria

### Phase 6b done
- All six `@homeslate/*` packages published to npm at `0.1.0` (or later patch).
- This repo builds, tests, and deploys with **no** local `packages/` directory.
- `npm run test:run` passes (hosted tests only).
- `netlify dev` smoke: `GET /api/displays` returns expected shape.
- `homeslate-oss` repo tests pass independently (`374` tests or equivalent after split).

### Phase 6c done
- GitHub repos named `homeslate` (public OSS) and `homeslate-hosted` (private).
- Netlify still deploys from `homeslate-hosted` without reconnecting the site.
- npm package `repository` fields point at `github.com/<org>/homeslate`.
- Clone URLs in READMEs updated.

## Open questions
1. npm org owner account — personal vs org? (Plan assumes org or user with `@homeslate` scope access.)
2. Automated publish on every `main` merge vs tag-only? (Plan assumes **tag/manual** for first release, CI workflow ready.)
3. Should `homeslate-oss` start public immediately or private until first publish? (Plan assumes **public** once packages are ready.)
