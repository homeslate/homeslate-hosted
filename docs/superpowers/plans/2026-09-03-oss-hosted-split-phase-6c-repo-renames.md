# Phase 6c Repo Renames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this phase is mostly GitHub/npm housekeeping, not code). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename repositories so the public OSS repo owns the `homeslate` name and the private hosted repo is `homeslate-hosted`, without breaking Netlify deploys.

**Architecture:** After Phase 6b proves hosted runs on npm packages, perform two GitHub renames in order: (1) this repo `homeslate` → `homeslate-hosted` to free the name; (2) `homeslate-oss` → `homeslate`. Update manifest metadata and clone URLs. Netlify stays connected to the hosted repo via GitHub redirects.

**Tech Stack:** GitHub repo settings, npm package metadata, git remotes.

**Spec:** `docs/superpowers/specs/2026-09-03-oss-hosted-split-phase-6b-6c-design.md`

**Prerequisite:** Phase 6b complete — hosted repo has no local `packages/`, production deploy uses `@homeslate/*` from npm.

## Global Constraints
- Do not rename repos until Phase 6b production deploy is confirmed green.
- Netlify site stays on the **hosted** repo (before rename: `homeslate`; after: `homeslate-hosted`).
- Do not republish npm packages solely for URL changes unless `repository` field updates require a patch release (metadata-only patch `0.1.1` is optional).

---

### Task 1: Pre-rename checklist

- [ ] **Step 1: Confirm Phase 6b done**

Hosted repo (`homeslate` today):
- No `packages/` or `apps/reference/` directories.
- `npm run build` and `npm run test:run` pass on `main`.
- Production Netlify deploy succeeded after npm switch.

OSS repo (`homeslate-oss`):
- CI green on `main`.
- `@homeslate/*@0.1.0` published and installable.

- [ ] **Step 2: Note current remotes**

```bash
# hosted checkout
git remote -v

# oss checkout
cd .worktrees/homeslate-oss && git remote -v
```

- [ ] **Step 3: Announce maintenance window (optional)**

Renames are quick (~5 min) but pause merges during the swap.

---

### Task 2: Rename hosted repo `homeslate` → `homeslate-hosted`

**Files:**
- GitHub repo settings only (no code change required)

- [ ] **Step 1: Rename on GitHub**

In GitHub → Settings → General → Repository name:

`homeslate` → `homeslate-hosted`

GitHub creates redirects from old URLs.

- [ ] **Step 2: Update local remote**

In hosted checkout:

```bash
git remote set-url origin git@github.com:<org>/homeslate-hosted.git
git fetch origin
```

- [ ] **Step 3: Verify Netlify**

In Netlify dashboard → Site settings → Build & deploy → Continuous deployment:

- Repository may still show old name or auto-update.
- Trigger **Clear cache and deploy site**.
- Confirm deploy succeeds.

If deploy fails to find repo: reconnect GitHub app to `homeslate-hosted` (redirect usually suffices).

- [ ] **Step 4: Verify env vars and domain**

Confirm all environment variables and custom domain unchanged.

---

### Task 3: Rename OSS repo `homeslate-oss` → `homeslate`

**Files:**
- Modify: oss repo `packages/*/package.json` (`repository.url`)
- Modify: oss repo `README.md` (clone URL)
- Modify: hosted repo `README.md` if it references clone URLs

- [ ] **Step 1: Rename on GitHub**

`homeslate-oss` → `homeslate`

- [ ] **Step 2: Update oss repo metadata**

In `.worktrees/homeslate-oss`, update every `packages/*/package.json`:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/<org>/homeslate.git"
}
```

Update root `README.md` clone instructions to `github.com/<org>/homeslate`.

- [ ] **Step 3: Update local remote**

```bash
cd .worktrees/homeslate-oss
git remote set-url origin git@github.com:<org>/homeslate.git
git add packages/*/package.json README.md
git commit -m "chore: update repository URLs after rename to homeslate"
git push
```

- [ ] **Step 4: Optional npm metadata patch**

If you want npm `repository` links updated immediately:

- Bump all packages to `0.1.1`
- Tag `v0.1.1` and run publish workflow

(Skip if `0.1.0` metadata is acceptable until next feature release.)

---

### Task 4: Update hosted repo docs and cross-links

**Files:**
- Modify: `README.md` in `homeslate-hosted`
- Modify: `docs/superpowers/specs/2026-09-03-oss-hosted-split-phase-6-design.md` (status note)

- [ ] **Step 1: Hosted README**

Document:
- This repo is **private hosted product** (`homeslate-hosted`).
- OSS lives at `github.com/<org>/homeslate`.
- Packages consumed from npm `@homeslate/*`.

- [ ] **Step 2: Mark specs complete**

Update Phase 6 design spec status to reflect 6a/6b/6c completion.

- [ ] **Step 3: Commit hosted doc updates**

```bash
git add README.md docs/
git commit -m "docs: reflect homeslate-hosted / homeslate repo split"
git push
```

---

### Task 5: Final verification

- [ ] **Step 1: Clone smoke test**

```bash
git clone git@github.com:<org>/homeslate.git /tmp/homeslate-oss-clone
cd /tmp/homeslate-oss-clone && npm ci && npm run test:run

git clone git@github.com:<org>/homeslate-hosted.git /tmp/homeslate-hosted-clone
cd /tmp/homeslate-hosted-clone && npm ci && npm run build
```

- [ ] **Step 2: npm install smoke from public registry**

```bash
npm view @homeslate/schema repository
```

- [ ] **Step 3: Production spot-check**

Load hosted app URL; sign in; open displays list; confirm no runtime import errors in browser console.

---

## Self-Review

1. **Spec coverage:** rename order, Netlify verification, URL updates — all tasks present.
2. **Placeholder scan:** no vague steps.
3. **Dependency order:** Task 2 before Task 3 (frees `homeslate` name).
4. **Remaining gaps:** none for rename phase.

## End state

| Repo | URL | Role |
|---|---|---|
| `homeslate` | `github.com/<org>/homeslate` | Public OSS + reference |
| `homeslate-hosted` | `github.com/<org>/homeslate-hosted` | Private hosted + Netlify |

Netlify deploys from `homeslate-hosted`. npm packages list `homeslate` as repository.
