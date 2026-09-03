# Phase 6b OSS Extract & npm Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract OSS packages to `homeslate-oss`, publish `@homeslate/*` to npm, and switch the hosted repo to consume those published versions — without touching Netlify site settings.

**Architecture:** Create a sibling GitHub repo (`homeslate-oss`) containing `packages/*`, `apps/reference`, and OSS-only tooling. Add `tsup` builds and a publish workflow. Once npm artifacts are verified, replace workspace path aliases in this repo with semver dependencies, delete local OSS directories, and slim workspaces to `apps/hosted` only.

**Tech Stack:** npm workspaces, tsup, GitHub Actions, Vitest, Vite, Netlify functions (esbuild).

**Spec:** `docs/superpowers/specs/2026-09-03-oss-hosted-split-phase-6b-6c-design.md`

## Global Constraints
- Keep Netlify connected to **this** repo throughout Phase 6b (no GitHub repo rename yet).
- MIT license on OSS packages + reference app; hosted remains private/proprietary.
- Preserve subpath exports: `@homeslate/widgets/schemas`, `@homeslate/widgets/server`, `@homeslate/display/canvas`.
- No entitlements, Stripe, or schema `layouts` → `views` rename in this phase.
- Initial npm version **`0.1.0`** for all six packages (lockstep).
- Do not edit OSS code in two repos in parallel after extract — `homeslate-oss` is source of truth for publish.

---

### Task 1: Claim npm scope and prepare package manifests for publish

**Files:**
- Modify: `packages/schema/package.json`
- Modify: `packages/google/package.json`
- Modify: `packages/widgets/package.json`
- Modify: `packages/display/package.json`
- Modify: `packages/editor/package.json`
- Modify: `packages/adapters/package.json`
- Create: `LICENSE` (MIT, repo root — copied to `homeslate-oss` in Task 2)

**Interfaces:**
- Consumes: existing `@homeslate/*` package names
- Produces: publish-ready manifests (`private: false`, `publishConfig`, semver `0.1.0`, `files: ["dist"]`, dist-based `exports`)

- [ ] **Step 1: Claim `@homeslate` on npmjs.com**

Create the `@homeslate` org (or ensure your npm user can publish scoped packages).

- [ ] **Step 2: Add MIT LICENSE at repo root**

Create `LICENSE` with standard MIT text and copyright holder name.

- [ ] **Step 3: Update `@homeslate/schema` manifest**

```json
{
  "name": "@homeslate/schema",
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "publishConfig": { "access": "public" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<org>/homeslate-oss.git"
  },
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "zod": "^4.3.6"
  }
}
```

Remove `"private": true`.

- [ ] **Step 4: Update remaining five package manifests similarly**

Apply the same pattern. Key differences:

`@homeslate/widgets` — multi-entry build:

```json
"scripts": {
  "build": "tsup src/index.ts src/schemas.ts src/server.ts --format esm --dts --clean"
},
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./schemas": { "types": "./dist/schemas.d.ts", "import": "./dist/schemas.js" },
  "./server": { "types": "./dist/server.d.ts", "import": "./dist/server.js" }
}
```

`@homeslate/display` — add `./canvas` export entry (`src/canvas/index.ts`).

Replace inter-package `"*"` deps with `"0.1.0"` (or `"workspace:*"` until publish, then `"0.1.0"` in oss repo).

- [ ] **Step 5: Add root devDependency on tsup**

In root `package.json` devDependencies: `"tsup": "^8.5.0"` (or current stable).

Run: `npm install`

- [ ] **Step 6: Verify local builds**

Run:

```bash
npm run build -w @homeslate/schema
npm run build -w @homeslate/google
npm run build -w @homeslate/widgets
npm run build -w @homeslate/display
npm run build -w @homeslate/editor
npm run build -w @homeslate/adapters
```

Expected: each package emits `dist/index.js` + `.d.ts` (and subpath files for widgets/display).

- [ ] **Step 7: Commit**

```bash
git add LICENSE packages/*/package.json package-lock.json
git commit -m "chore: prepare @homeslate packages for npm publish"
```

---

### Task 2: Create `homeslate-oss` repository and populate it

**Files:**
- Create: GitHub repo `homeslate-oss` (via `gh repo create`)
- Copy to oss repo:
  - `packages/**`
  - `apps/reference/**`
  - `LICENSE`
  - `package.json` (oss-only workspaces)
  - `package-lock.json` (regenerated)
  - `vitest.config.ts` (oss paths only)
  - `eslint.config.js`
  - `tsconfig.json`, `tsconfig.node.json` (as needed)
  - `docs/superpowers/**` (OSS-related docs)
  - `.gitignore`
- Create in oss repo: `README.md` (OSS-focused)

**Interfaces:**
- Consumes: Task 1 publish-ready manifests
- Produces: standalone `homeslate-oss` repo where `npm run test:run` passes

- [ ] **Step 1: Create GitHub repo**

```bash
gh repo create homeslate-oss --public --description "Homeslate OSS packages and reference app"
```

- [ ] **Step 2: Clone into worktree**

```bash
git worktree add .worktrees/homeslate-oss ../homeslate-oss-origin main 2>/dev/null || \
  git clone git@github.com:<org>/homeslate-oss.git .worktrees/homeslate-oss
```

(Use whichever matches your setup; worktree under `.worktrees/` per project convention.)

- [ ] **Step 3: Write oss-only root `package.json`**

```json
{
  "name": "homeslate-oss",
  "private": true,
  "workspaces": ["packages/*", "apps/reference"],
  "type": "module",
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "vitest",
    "test:run": "vitest run",
    "dev:reference": "npm run dev -w homeslate-reference"
  }
}
```

- [ ] **Step 4: Copy OSS directories and configs**

Copy from this monorepo into `.worktrees/homeslate-oss/`:

- `packages/`
- `apps/reference/`
- `LICENSE`
- `eslint.config.js`
- `vitest.config.ts` (keep package + reference includes; drop `apps/hosted/**`)
- Reference tsconfigs under `apps/reference/`

Add `README.md`:

```markdown
# Homeslate (OSS)

Public MIT packages and reference self-host app for Homeslate.

## Packages
- @homeslate/schema
- @homeslate/google
- @homeslate/widgets
- @homeslate/editor
- @homeslate/display
- @homeslate/adapters

## Reference app
`npm run dev:reference` — Hono API + Vite UI.
```

- [ ] **Step 5: Wire reference app to workspace packages (interim)**

In oss repo, `apps/reference/package.json` deps stay `"workspace:*"` or `"*"` until npm publish; vite/tsconfig path aliases remain for dev.

- [ ] **Step 6: Install and test in oss repo**

```bash
cd .worktrees/homeslate-oss
npm install
npm run build
npm run test:run
```

Expected: **374 tests pass** (minus any hosted-only tests that were copied by mistake — remove those).

- [ ] **Step 7: Push initial commit**

```bash
git add -A
git commit -m "feat: initial OSS monorepo extract"
git push -u origin main
```

- [ ] **Step 8: Do NOT delete packages from hosted repo yet**

Leave `packages/*` in this repo until Task 4 npm switch is validated.

---

### Task 3: Add publish CI to `homeslate-oss`

**Files:**
- Create: `.worktrees/homeslate-oss/.github/workflows/ci.yml`
- Create: `.worktrees/homeslate-oss/.github/workflows/publish.yml`

**Interfaces:**
- Consumes: Task 2 oss repo
- Produces: automated test/build; manual or tag-triggered npm publish

- [ ] **Step 1: CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run test:run
```

- [ ] **Step 2: Publish workflow**

Create `.github/workflows/publish.yml`:

```yaml
name: Publish
on:
  workflow_dispatch:
  push:
    tags: ["v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          registry-url: https://registry.npmjs.org
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run test:run
      - run: |
          for pkg in schema google widgets display editor adapters; do
            npm publish -w "@homeslate/$pkg" --access public
          done
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Publish order is enforced by npm if versions depend on already-published siblings — publish in dependency order if the loop fails.

- [ ] **Step 3: Add `NPM_TOKEN` secret to `homeslate-oss` repo**

Generate npm granular token (publish scope for `@homeslate/*`), add as GitHub Actions secret.

- [ ] **Step 4: Push workflows**

```bash
git add .github/
git commit -m "ci: add test and npm publish workflows"
git push
```

---

### Task 4: First npm release from `homeslate-oss`

**Files:**
- Modify: oss repo package versions (already `0.1.0`)

**Interfaces:**
- Consumes: Task 3 CI + NPM_TOKEN
- Produces: `@homeslate/*@0.1.0` on npm registry

- [ ] **Step 1: Dry-run publish locally (optional sanity check)**

```bash
cd .worktrees/homeslate-oss
npm run build
npm publish -w @homeslate/schema --dry-run
```

Expected: tarball contains `dist/` only, not `src/`.

- [ ] **Step 2: Publish via CI**

```bash
git tag v0.1.0
git push origin v0.1.0
```

Or trigger `workflow_dispatch` on Publish workflow.

- [ ] **Step 3: Verify on npm**

```bash
npm view @homeslate/schema version
npm view @homeslate/widgets exports
npm view @homeslate/display exports
```

Expected: version `0.1.0`, exports include subpaths.

- [ ] **Step 4: Smoke-install in temp directory**

```bash
mkdir /tmp/homeslate-npm-smoke && cd /tmp/homeslate-npm-smoke
npm init -y
npm install @homeslate/schema@0.1.0 @homeslate/widgets@0.1.0
node -e "import('@homeslate/schema').then(m => console.log(Object.keys(m)))"
```

Expected: module resolves without error.

---

### Task 5: Switch hosted repo from workspace aliases to npm deps

**Files:**
- Modify: root `package.json` (add `@homeslate/*` deps, remove OSS workspaces later)
- Modify: `apps/hosted/package.json` (optional: declare deps here instead of root)
- Modify: `apps/hosted/vite.config.ts` (remove `@homeslate/*` aliases)
- Modify: `tsconfig.app.json` (remove paths + package includes)
- Modify: `vitest.config.ts` (remove aliases; hosted tests only)
- Modify: `apps/hosted/netlify/functions/display-calendar.ts` (fix deep import)
- Delete: `packages/**`
- Delete: `apps/reference/**`
- Delete: stale `netlify/functions/**` at repo root

**Interfaces:**
- Consumes: `@homeslate/*@0.1.0` from npm
- Produces: hosted repo with zero local OSS source

- [ ] **Step 1: Add npm dependencies**

In root `package.json` dependencies:

```json
"@homeslate/adapters": "0.1.0",
"@homeslate/display": "0.1.0",
"@homeslate/editor": "0.1.0",
"@homeslate/google": "0.1.0",
"@homeslate/schema": "0.1.0",
"@homeslate/widgets": "0.1.0"
```

Run: `npm install`

- [ ] **Step 2: Remove Vite path aliases**

In `apps/hosted/vite.config.ts`, delete the entire `resolve.alias` block for `@homeslate/*`. Vite resolves from `node_modules`.

- [ ] **Step 3: Remove TypeScript path aliases**

In `tsconfig.app.json`:

- Delete all `"@homeslate/*"` entries from `paths`.
- Change `include` to only `["apps/hosted/src"]`.

- [ ] **Step 4: Slim vitest config**

In `vitest.config.ts`:

- Remove `resolve.alias` for `@homeslate/*`.
- Change `include` to only:
  - `apps/hosted/src/**/*.test.ts`
  - `apps/hosted/src/**/*.test.tsx`

- [ ] **Step 5: Fix Netlify deep import**

In `apps/hosted/netlify/functions/display-calendar.ts`, replace:

```ts
import { DISPLAY_GOOGLE_RECONNECT_MESSAGE } from '../../../../packages/widgets/src/widgets/googleCalendarError';
```

with:

```ts
import { DISPLAY_GOOGLE_RECONNECT_MESSAGE } from '@homeslate/widgets';
```

- [ ] **Step 6: Delete OSS directories and stale netlify functions**

```bash
rm -rf packages apps/reference netlify/functions
```

- [ ] **Step 7: Update root workspaces**

In root `package.json`:

```json
"workspaces": ["apps/hosted"]
```

Remove scripts: `dev:reference`, `typecheck:reference`.

- [ ] **Step 8: Verify**

```bash
npm run test:run
npx tsc -b --pretty false
npm run build
```

Expected: all pass.

- [ ] **Step 9: Netlify smoke**

```bash
netlify dev
```

Confirm `GET /api/displays` (or OPTIONS preflight) responds as before.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: consume @homeslate packages from npm"
```

---

### Task 6: Deploy preview validation

**Files:**
- none (verification only)

- [ ] **Step 1: Push branch and open PR**

Push Task 5 branch; confirm Netlify deploy preview builds using npm packages (not local `packages/`).

- [ ] **Step 2: Merge to main**

After preview is green, merge to `main` and confirm production deploy succeeds.

- [ ] **Step 3: Checkpoint**

Phase 6b is complete when production runs on npm deps with no `packages/` in this repo. Proceed to Phase 6c repo renames.

---

## Self-Review

1. **Spec coverage:** extract → publish → npm switch → delete local OSS — all covered in Tasks 2–5.
2. **Placeholder scan:** no TBD steps; commands and manifest shapes are concrete.
3. **Type consistency:** subpath exports preserved in Task 1; Task 5 import fix uses public export.
4. **Remaining gaps:** Changesets/version automation deferred; entitlements still out of scope.
