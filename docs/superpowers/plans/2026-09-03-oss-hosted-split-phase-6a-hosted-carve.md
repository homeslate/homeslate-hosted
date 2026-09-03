# Phase 6a Hosted Carve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carve the hosted management app and Netlify server code into `apps/hosted` with no functional behavior change, so we can merge it to `main` and validate it works first.

**Architecture:** We keep all existing public OSS packages as-is. We introduce a new workspace package `apps/hosted` and move:
- the hosted UI entry (`index.html`, `src/**`)
- hosted Netlify functions (`netlify/functions/**`, plus config changes)

We then update TypeScript/Vitest/Vite/Netlify wiring so the hosted app still builds/tests and Netlify still serves the same endpoints.

**Tech Stack:** TypeScript, React, Vite, Vitest, npm workspaces, Netlify functions (esbuild), Drizzle/Neon (host-only code).

**Spec:** `docs/superpowers/specs/2026-09-03-oss-hosted-split-phase-6-design.md`

## Global Constraints
- Move the remaining hosted app behind a new `apps/hosted` boundary inside this repository, without changing hosted behavior.
- Keep hosted code in this repo for now (Netlify remains configured here). Move OSS packages to a new public repo only later.
- No replacement of the entire hosted persistence model (no “rewrite to new store” during the carve).
- No Stripe wiring or free-tier numeric configuration in this phase (entitlements may be stubbed to “unlimited” until billing exists).
- No new public packages; do not change the public MIT surface.
- Success criteria (Phase 6 carve merge):
  - `main` still builds/tests successfully after `apps/hosted` is merged.
  - Netlify functions still resolve and serve the same endpoints.
  - No changes are required for self-host/reference path (`apps/reference`) beyond dependency wiring.
  - Public package boundaries remain enforced by tests (e.g. host import greps).

---

### Task 1: Create `apps/hosted` and move the hosted UI

**Files:**
- Create: `apps/hosted/package.json`
- Create: `apps/hosted/index.html` (copy of root `index.html`)
- Create: `apps/hosted/vite.config.ts` (ported from root `vite.config.ts`, with the same React/PWA and proxy behavior)
- Create: `apps/hosted/tsconfig.json` (Node-safe/bundler TS config for the hosted UI)
- Modify: `package.json` scripts to run hosted build/dev from `apps/hosted`
- Modify: `tsconfig.app.json` include paths (replace `src` with `apps/hosted/src`)
- Modify: `vitest.config.ts` include paths (replace `src/**/*.test*` with `apps/hosted/src/**/*.test*`)
- Move: `src/**` → `apps/hosted/src/**`
- Move: `vite.config.ts` (if you delete the root file, also adjust any scripts/tests that import it)
- Move: `src/main.tsx` and `src/vite-env.d.ts` as part of `src/**`
- Delete or leave behind at root only if a build/test still references them (do NOT keep two hosted sources in parallel)

**Interfaces:**
- Consumes: existing Vite/React hosted entrypoints and components from `src/**`
- Produces: a working hosted UI build/dev server from `apps/hosted` that mounts the existing management app as before

- [ ] **Step 1: Run baseline**

Run on current `main`:
`npm run test:run` and `npx tsc -b --pretty false`.

- [ ] **Step 2: Scaffold `apps/hosted`**

Create `apps/hosted/package.json` with scripts mirroring the existing root UI workflow:
`dev`, `build`, `typecheck`, and (if needed) `test`.

Create `apps/hosted/vite.config.ts` by copying root `vite.config.ts`, but ensure the Vite project root is effectively `apps/hosted` (so module resolution and `index.html` line up).

- [ ] **Step 3: Move hosted UI sources**

Move:
- `index.html` → `apps/hosted/index.html`
- `src/**` → `apps/hosted/src/**`

Then update the `apps/hosted/index.html` `<script type="module" src="/src/main.tsx">` to point to the correct entry within the `apps/hosted` root (Vite expects it under `/src/main.tsx` relative to the Vite root).

- [ ] **Step 4: Update TS/Vitest wiring**

Update `tsconfig.app.json` to include `apps/hosted/src` instead of root `src`.

Update `vitest.config.ts` to include:
- `apps/hosted/src/**/*.test.ts`
- `apps/hosted/src/**/*.test.tsx`

- [ ] **Step 5: Verify hosted-only**

Run:
`npx vitest run`
and:
`npx tsc -b --pretty false`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message:
`feat: carve hosted UI into apps/hosted`

---

### Task 2: Move Netlify functions into `apps/hosted`

**Files:**
- Move: `netlify/functions/**` → `apps/hosted/netlify/functions/**`
- Modify: `netlify.toml`:
  - `functions.directory` points at `apps/hosted/netlify/functions`
  - `build.command` points at hosted build script (workspace `-w homeslate-hosted`)
- Modify: Vite proxy rewrite target if necessary (should still rewrite `/api` → `/.netlify/functions`)

**Interfaces:**
- Consumes: existing Netlify handlers under `netlify/functions/**`
- Produces: identical `/api/*` and `/.netlify/functions/*` behavior when running `netlify dev`

- [ ] **Step 1: Verify netlify mapping**

After moving functions, update `netlify.toml` and ensure the SPA redirects remain unchanged:
`from = "/api/*"` and `from = "/*"` redirects still target `/.netlify/functions/:splat` and `index.html` respectively.

- [ ] **Step 2: Run netlify type checks (best-effort)**

Because the repo’s `tsc -b` currently does not include `netlify/**` by default, run the closest available hosted validation:
`npx tsc -b --pretty false` (should remain clean)
and:
`npm run lint` (best-effort; do not expand eslint scope unless needed).

- [ ] **Step 3: Smoke `netlify dev`**

Start `netlify dev` manually (no automation required), and confirm:
- Visiting `/api/displays` endpoints via the hosted UI still works
- `GET /api/display-calendar` still responds with the same payload shape

Expected: no endpoint regressions.

- [ ] **Step 4: Commit**

Commit message:
`feat: move Netlify functions under apps/hosted`

---

### Task 3: Ensure repo-level build/test still works after the carve

**Files:**
- Modify: root `package.json` scripts (dev/build/test/typecheck now delegate to hosted workspace where appropriate)
- Modify: root `vite.config.ts` only if it is still required after Vite is moved under `apps/hosted`
- Modify: root `tsconfig.*` / `vitest.config.ts` if any tooling still references old paths

- [ ] **Step 1: Run full test suite**

`npm run test:run`

- [ ] **Step 2: Run TypeScript solution builds**

`npx tsc -b --pretty false`

Expected: PASS.

- [ ] **Step 3: Commit**

Commit message:
`chore: update root tooling for apps/hosted`

---

### Task 4: Integration handoff checkpoint (merge after tests)

**Files:**
- none (controller action)

- [ ] **Step 1: Merge readiness**

After Task 1–3 pass:
- Ensure `main` builds/tests clean.
- Controller merges to `main` and stops here (before Phase 6 entitlement repo-splitting and any further refactors).

---

## Self-Review
1. Spec coverage: hosted carve is exactly what the Phase 6 spec proposes for the first merge.
2. Placeholder scan: no “TBD” / “TODO” / vague steps; commands are concrete.
3. Type consistency: TypeScript config updates move the compiler scope from `src` to `apps/hosted/src`.
4. Remaining gaps: entitlement enforcement is explicitly deferred to later Phase 6 steps.

