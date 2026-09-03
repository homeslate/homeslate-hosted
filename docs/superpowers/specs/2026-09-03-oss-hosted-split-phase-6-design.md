# OSS / Hosted Split — Phase 6: `apps/hosted` carve & repo split order

## Status
Phase 6a complete (merged `602983d`). Phases 6b–6c proposed — see `2026-09-03-oss-hosted-split-phase-6b-6c-design.md`.

## Goal
Move the remaining **hosted app** (management UI + auth/billing glue + Netlify/Neon server code + entitlement checks) behind a new `apps/hosted` boundary inside this repository, without changing hosted behavior.

Additionally, adopt the following repo split order:
1. **Carve and merge `apps/hosted` first** (so hosted continues to work in this repo).
2. **After that merge succeeds, move the OSS packages to a new public repo** (since Netlify is already set up for this repo, we keep hosted here initially).

The design doc from Phase 5 already created the seam for public OSS (`@homeslate/schema`, `widgets`, `editor`, `display`, `google`, `adapters`) and a self-host/reference path (`apps/reference`).

## Non-goals (for the first commit)
- No replacement of the entire hosted persistence model (no “rewrite to new store” during the carve).
- No Stripe wiring or free-tier numeric configuration in this phase (entitlements may be stubbed to “unlimited” until billing exists).
- No new public packages; do not change the public MIT surface.

## High-level approach

### Step 1: Transitional hosted carve (`apps/hosted`)
Create `apps/hosted/` and move the current hosted sources under it:
- Management UI frontend (previously `src/**` in this repo)
- Hosted server code (previously `netlify/functions/**` and any hosted-only shared server helpers)

Update workspace + tool configs so:
- Hosted builds/tests still pass
- Public packages continue to compile independently
- There are no new imports from public packages into hosted-only code paths that would break the “public-core” contract.

### Step 2: Hosted entitlements layer (stubbed unless already present)
Introduce a hosted-only entitlement error type and enforcement hook at the hosted persistence boundary:
- Define hosted-only `EntitlementError` with codes:
  - `display_limit`
  - `view_limit`
- Enforce on hosted `create`/`put` paths only.
- If there is no billing/plan configuration in this repo yet, provide an entitlements provider that returns `unlimited` by default so the UI can still implement error handling without breaking.

### Step 3: UI upgrade handling
Update the hosted management chrome to catch entitlement failures and show the upgrade UI state.

## Repo split order decision (updated after 6a)
Approved sequence:

1. **6a (done):** carve `apps/hosted` in this repo.
2. **6b:** extract OSS to temporary `homeslate-oss`, publish `@homeslate/*` to npm, switch hosted to npm deps, delete local `packages/`.
3. **6c:** rename this repo `homeslate` → `homeslate-hosted`, then `homeslate-oss` → `homeslate`.

Netlify stays on the hosted repo through 6b; renames in 6c are cosmetic once npm boundary is proven.

See: `docs/superpowers/plans/2026-09-03-oss-hosted-split-phase-6b-oss-extract-npm.md` and `docs/superpowers/plans/2026-09-03-oss-hosted-split-phase-6c-repo-renames.md`.

## Success criteria (Phase 6 carve merge)
- `main` still builds/tests successfully after `apps/hosted` is merged.
- Netlify functions still resolve and serve the same endpoints.
- No changes are required for self-host/reference path (`apps/reference`) beyond dependency wiring.
- Public package boundaries remain enforced by tests (e.g. host import greps).

## Dependencies
- Phase 5 must remain merged (adapters + reference app).
- Any “hosted persistence boundary” changes should be localized to hosted code.

## Open questions
1. Do we want entitlement enforcement to be fully stubbed to “unlimited” for the first merge, or do you already have a local config source for `maxDisplays` / `maxViewsPerDisplay` we should use?

