# PWA Display Update Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On display/viewer sessions, show an “Updating…” toast for ~3s then reload when a new PWA version is available; on management sessions, quietly activate the new service worker with no toast and no forced reload.

**Architecture:** Switch `vite-plugin-pwa` to `registerType: 'prompt'`. A small `pwaUpdate` coordinator owns SW registration, the 30‑minute poll, a display-session flag, and `onNeedRefresh` branching. `App` marks display sessions early (before `DisplayViewer` paints). `DisplayViewer` subscribes, shows a local toast overlay, then calls `applyUpdate(true)`.

**Tech Stack:** Vite, `vite-plugin-pwa` (`virtual:pwa-register`), React 19, TypeScript, existing CSS modules, Vitest.

## Global Constraints

- Toast copy: **“Updating…”**
- Toast delay before reload: **~3 seconds**
- Poll interval: **30 minutes** (unchanged)
- Toast only on **display / viewer** sessions (including in-app preview when `DisplayViewer` is shown)
- Management: **`updateSW(false)`** — no toast, no forced reload
- Toast UI: **viewer-local overlay** — do not add `@mantine/notifications`
- Keep **DEV** behavior that unregisters leftover production service workers
- Do not change Workbox runtime caching rules beyond `registerType`

## File Structure

| File | Responsibility |
|------|----------------|
| `src/pwaUpdate.ts` | Coordinator: session flag, pending update, subscribe, register + poll, applyUpdate |
| `src/pwaUpdate.test.ts` | Unit tests for display vs management branching |
| `src/components/PwaUpdateToast.tsx` | Bottom-center “Updating…” overlay + delayed `applyUpdate(true)` |
| `src/components/PwaUpdateToast.module.css` | Toast layout/styles |
| Modify: `vite.config.ts` | `registerType: 'prompt'` |
| Modify: `src/main.tsx` | Call `registerPwaUpdates()` instead of inline `registerSW` |
| Modify: `src/App.tsx` | Early + runtime `setDisplaySession` for display / preview / management |
| Modify: `src/components/DisplayViewer.tsx` | Mount `<PwaUpdateToast />` |

---

### Task 1: `pwaUpdate` Coordinator + Unit Tests

**Files:**
- Create: `src/pwaUpdate.ts`
- Test: `src/pwaUpdate.test.ts`

**Interfaces:**
- Produces:
  - `setDisplaySession(active: boolean): void`
  - `subscribeToPendingUpdate(listener: () => void): () => void`
  - `applyUpdate(reload: boolean): void`
  - `registerPwaUpdates(options?: RegisterPwaUpdatesOptions): void`
  - `resetPwaUpdateForTests(): void` (test-only reset of module state)
- `RegisterPwaUpdatesOptions` (for tests / injection):
  - `registerSW?: typeof registerSW` (default: import from `virtual:pwa-register`)
  - `checkIntervalMs?: number` (default: `30 * 60 * 1000`)

**Behavior to implement (and test without a real SW):**

1. `onNeedRefresh` when **display session is active**: set pending; notify subscribers; **do not** call `applyUpdate`.
2. `onNeedRefresh` when **display session is inactive**: call `applyUpdate(false)`; clear pending.
3. `subscribeToPendingUpdate`: if already pending **and** display session active, invoke listener immediately; return unsubscribe.
4. `setDisplaySession(true)` while pending: notify subscribers once (toast path); do not quiet-activate.
5. `applyUpdate(reload)`: invoke the stored `updateSW(reload)` from `registerSW`; clear pending.

- [ ] **Step 1: Write the failing tests**

Create `src/pwaUpdate.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyUpdate,
  registerPwaUpdates,
  resetPwaUpdateForTests,
  setDisplaySession,
  subscribeToPendingUpdate,
} from './pwaUpdate';

afterEach(() => {
  resetPwaUpdateForTests();
});

describe('pwaUpdate coordinator', () => {
  it('quiet-activates when update arrives outside a display session', () => {
    const updateSW = vi.fn();
    const registerSW = vi.fn((opts: { onNeedRefresh?: () => void }) => {
      queueMicrotask(() => opts.onNeedRefresh?.());
      return updateSW;
    });

    setDisplaySession(false);
    registerPwaUpdates({ registerSW: registerSW as never, checkIntervalMs: 60_000 });

    return Promise.resolve().then(() => {
      expect(updateSW).toHaveBeenCalledWith(false);
    });
  });

  it('notifies subscribers and does not apply when display session is active', async () => {
    const updateSW = vi.fn();
    let onNeedRefresh: (() => void) | undefined;
    const registerSW = vi.fn((opts: { onNeedRefresh?: () => void }) => {
      onNeedRefresh = opts.onNeedRefresh;
      return updateSW;
    });

    setDisplaySession(true);
    registerPwaUpdates({ registerSW: registerSW as never });

    const listener = vi.fn();
    subscribeToPendingUpdate(listener);
    onNeedRefresh?.();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(updateSW).not.toHaveBeenCalled();

    applyUpdate(true);
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('invokes subscriber immediately if update is already pending in a display session', () => {
    const updateSW = vi.fn();
    let onNeedRefresh: (() => void) | undefined;
    const registerSW = vi.fn((opts: { onNeedRefresh?: () => void }) => {
      onNeedRefresh = opts.onNeedRefresh;
      return updateSW;
    });

    setDisplaySession(true);
    registerPwaUpdates({ registerSW: registerSW as never });
    onNeedRefresh?.();

    const listener = vi.fn();
    subscribeToPendingUpdate(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(updateSW).not.toHaveBeenCalled();
  });

  it('notifies when display session becomes active while update is pending', () => {
    const updateSW = vi.fn();
    let onNeedRefresh: (() => void) | undefined;
    const registerSW = vi.fn((opts: { onNeedRefresh?: () => void }) => {
      onNeedRefresh = opts.onNeedRefresh;
      return updateSW;
    });

    // Start as display so onNeedRefresh does not quiet-activate; then leave session
    // with pending still true by simulating: need refresh while display, listener not yet mounted.
    setDisplaySession(true);
    registerPwaUpdates({ registerSW: registerSW as never });
    onNeedRefresh?.();
    expect(updateSW).not.toHaveBeenCalled();

    setDisplaySession(false);
    // Pending remains true until applyUpdate; becoming display again should notify.
    const listener = vi.fn();
    subscribeToPendingUpdate(listener);
    expect(listener).not.toHaveBeenCalled(); // not display anymore at subscribe time

    setDisplaySession(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pwaUpdate.test.ts`

Expected: FAIL (module missing / exports missing).

- [ ] **Step 3: Write minimal implementation**

Create `src/pwaUpdate.ts`:

```ts
import { registerSW as defaultRegisterSW } from 'virtual:pwa-register'

type UpdateSW = (reloadPage?: boolean) => Promise<void>
type RegisterSW = (options?: {
  immediate?: boolean
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void
  onNeedRefresh?: () => void
  onOfflineReady?: () => void
}) => UpdateSW

export interface RegisterPwaUpdatesOptions {
  registerSW?: RegisterSW
  checkIntervalMs?: number
}

const DEFAULT_CHECK_INTERVAL_MS = 30 * 60 * 1000

let displaySession = false
let pendingUpdate = false
let updateSW: UpdateSW | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function notifyPending(): void {
  for (const listener of listeners) listener()
}

export function setDisplaySession(active: boolean): void {
  const wasActive = displaySession
  displaySession = active
  if (active && !wasActive && pendingUpdate) notifyPending()
}

export function subscribeToPendingUpdate(listener: () => void): () => void {
  listeners.add(listener)
  if (pendingUpdate && displaySession) listener()
  return () => {
    listeners.delete(listener)
  }
}

export function applyUpdate(reload: boolean): void {
  pendingUpdate = false
  void updateSW?.(reload)
}

function handleNeedRefresh(): void {
  pendingUpdate = true
  if (displaySession) {
    notifyPending()
    return
  }
  applyUpdate(false)
}

export function registerPwaUpdates(options: RegisterPwaUpdatesOptions = {}): void {
  if (updateSW) return

  const register = options.registerSW ?? defaultRegisterSW
  const checkIntervalMs = options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS

  updateSW = register({
    immediate: true,
    onNeedRefresh: handleNeedRefresh,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      pollTimer = setInterval(async () => {
        if (registration.installing || !navigator) return
        if ('connection' in navigator && (navigator as Navigator & { onLine?: boolean }).onLine === false) {
          return
        }
        try {
          const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: { cache: 'no-store', 'cache-control': 'no-cache' },
          })
          if (resp?.status === 200) await registration.update()
        } catch {
          // Ignore fetch errors (offline, server down)
        }
      }, checkIntervalMs)
    },
  })
}

/** Clears module state between Vitest cases. */
export function resetPwaUpdateForTests(): void {
  displaySession = false
  pendingUpdate = false
  updateSW = null
  listeners.clear()
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
```

Notes for the implementer:

- Vitest may not resolve `virtual:pwa-register`. If import fails under test, either:
  - dynamic-import `virtual:pwa-register` only inside the default path of `registerPwaUpdates`, **or**
  - add a vitest alias that mocks `virtual:pwa-register` to `{ registerSW: () => () => {} }`.
- Prefer dynamic import / optional default so unit tests that always inject `registerSW` never load the virtual module:

```ts
export async function registerPwaUpdates(...): Promise<void> // avoid unless needed
```

Preferred fix: keep sync API; lazy-require via:

```ts
async function loadDefaultRegisterSW(): Promise<RegisterSW> {
  const mod = await import('virtual:pwa-register')
  return mod.registerSW
}
```

If that forces `registerPwaUpdates` async, update tests and `main.tsx` accordingly (`void registerPwaUpdates()`). **Simpler preferred approach for this repo:** in `vitest.config.ts` add:

```ts
resolve: {
  alias: {
    'virtual:pwa-register': new URL('./src/test/virtual-pwa-register stub', import.meta.url).pathname,
  },
},
```

Create `src/test/virtual-pwa-register.ts`:

```ts
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {}
}
```

Alias in `vitest.config.ts`:

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // ...existing
  resolve: {
    alias: {
      'virtual:pwa-register': path.join(root, 'src/test/virtual-pwa-register.ts'),
    },
  },
})
```

Include the stub + vitest alias in this task if needed to make tests run.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pwaUpdate.test.ts`

Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add src/pwaUpdate.ts src/pwaUpdate.test.ts src/test/virtual-pwa-register.ts vitest.config.ts
git commit -m "$(cat <<'EOF'
Add PWA update coordinator with display vs management branching.

EOF
)"
```

(Only stage files that actually exist after this task.)

---

### Task 2: Switch Vite PWA to `prompt` and Wire `main.tsx`

**Files:**
- Modify: `vite.config.ts` (change `registerType: 'autoUpdate'` → `'prompt'`)
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `registerPwaUpdates` from `src/pwaUpdate.ts`
- Produces: production SW registration via coordinator; DEV unregister path unchanged

- [ ] **Step 1: Change Vite PWA register type**

In `vite.config.ts`, inside `VitePWA({...})`:

```ts
registerType: 'prompt',
```

- [ ] **Step 2: Replace inline `registerSW` in `main.tsx`**

Replace the production block with:

```ts
import { registerPwaUpdates } from './pwaUpdate'

if (import.meta.env.PROD) {
  registerPwaUpdates()
}
```

Remove the direct `virtual:pwa-register` import from `main.tsx` (it now lives in `pwaUpdate.ts`).

Keep the DEV unregister block unchanged:

```ts
if (import.meta.env.DEV && navigator.serviceWorker?.controller) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    Promise.all(regs.map((r) => r.unregister())).then(() => location.reload());
  });
}
```

- [ ] **Step 3: Smoke-check TypeScript / tests**

Run: `npx vitest run src/pwaUpdate.test.ts`

Expected: PASS.

Run: `npx tsc -b --pretty false` (or the repo’s usual typecheck if different — check `package.json` scripts; if none, rely on IDE/vitest).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts src/main.tsx
git commit -m "$(cat <<'EOF'
Wire prompt-mode PWA registration through pwaUpdate.

EOF
)"
```

---

### Task 3: Early Display Session Flag in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `setDisplaySession` from `src/pwaUpdate.ts`
- Produces: display session flagged before `DisplayViewer` paints whenever a display id is resolved or preview is active

- [ ] **Step 1: Mark display session at module load**

Immediately after the existing `_initialDisplayParam` / `persistDisplayId` block in `src/App.tsx`, add:

```ts
import { setDisplaySession } from './pwaUpdate';

// ... existing persistDisplayId block ...

if (resolveDisplayId()) {
  setDisplaySession(true);
}
```

This must run at module evaluation time so a racing `onNeedRefresh` (right after `registerPwaUpdates()` in `main.tsx`) still sees a display session on kitchen tablets. Import order already evaluates `App.tsx` before `registerPwaUpdates()` because `main.tsx` imports `App` first.

- [ ] **Step 2: Keep the flag in sync inside `AppInner`**

In `AppInner`, after computing routes:

```ts
const displayParam = resolveDisplayId();

if (displayParam) {
  setDisplaySession(true);
  return <DisplayViewer displayId={displayParam} />;
}

clearSessionDisplayId();

// ... auth gate ...

if (preview) {
  setDisplaySession(true);
  return ( /* existing preview JSX with DisplayViewer */ );
}

setDisplaySession(false);
return ( /* Routes ... */ );
```

Do **not** call `setDisplaySession` during `/pair` unless you later decide pairing should toast — out of scope: leave pair as non-display (`false` or unchanged). After clearing toward management, ensure `setDisplaySession(false)` runs once for the management tree.

Avoid calling `setDisplaySession` every render in a hot loop if it notifies listeners when pending — the coordinator only notifies when `active && pendingUpdate`, so idempotent `setDisplaySession(true)` while already true is fine if implemented as:

```ts
export function setDisplaySession(active: boolean): void {
  const was = displaySession
  displaySession = active
  if (active && !was && pendingUpdate) notifyPending()
}
```

Update Task 1 implementation to use that “edge-triggered” notify if tests still pass (adjust the “becomes active while pending” test — it already requires a false→true transition).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/pwaUpdate.ts src/pwaUpdate.test.ts
git commit -m "$(cat <<'EOF'
Mark PWA display sessions early so update toasts win the race.

EOF
)"
```

---

### Task 4: `PwaUpdateToast` Overlay in `DisplayViewer`

**Files:**
- Create: `src/components/PwaUpdateToast.tsx`
- Create: `src/components/PwaUpdateToast.module.css`
- Modify: `src/components/DisplayViewer.tsx`

**Interfaces:**
- Consumes: `subscribeToPendingUpdate`, `applyUpdate` from `src/pwaUpdate.ts`
- Produces: bottom-center “Updating…” toast; after 3000ms calls `applyUpdate(true)` once

- [ ] **Step 1: Add toast CSS**

Create `src/components/PwaUpdateToast.module.css`:

```css
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 10000;
  padding: 12px 20px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--mantine-color-dark-7, #25262b) 92%, transparent);
  color: var(--mantine-color-gray-0, #fff);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
```

- [ ] **Step 2: Add `PwaUpdateToast` component**

Create `src/components/PwaUpdateToast.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { applyUpdate, subscribeToPendingUpdate } from '../pwaUpdate';
import classes from './PwaUpdateToast.module.css';

const RELOAD_DELAY_MS = 3000;

export function PwaUpdateToast() {
  const [visible, setVisible] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    return subscribeToPendingUpdate(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      setVisible(true);
      window.setTimeout(() => {
        applyUpdate(true);
      }, RELOAD_DELAY_MS);
    });
  }, []);

  if (!visible) return null;

  return (
    <div className={classes.toast} role="status" aria-live="polite">
      Updating…
    </div>
  );
}
```

- [ ] **Step 3: Mount toast in `DisplayViewer`**

In `src/components/DisplayViewer.tsx`:

1. Import `PwaUpdateToast`.
2. Inside the main viewer return (the `classes.root` tree) **and** optionally the pin-lock screen branch so an update during PIN entry still toast+reloads — prefer mounting once at the top of every return path, or wrap both returns.

Minimal approach: render `<PwaUpdateToast />` in both the pin screen return and the main dashboard return:

```tsx
return (
  <div className={classes.pinScreen}>
    <PwaUpdateToast />
    {/* existing pin UI */}
  </div>
);
```

and

```tsx
<div ref={rootRef} className={classes.root} style={...}>
  <PwaUpdateToast />
  {/* existing content */}
</div>
```

- [ ] **Step 4: Run unit tests**

Run: `npx vitest run src/pwaUpdate.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PwaUpdateToast.tsx src/components/PwaUpdateToast.module.css src/components/DisplayViewer.tsx
git commit -m "$(cat <<'EOF'
Show Updating toast on display viewer before PWA reload.

EOF
)"
```

---

### Task 5: Manual Verification Notes (No Code)

**Files:** none (checklist only)

- [ ] **Step 1: Local mental / optional staging check**

After deploy (or a production build served locally):

1. Open the kitchen display URL (`?display=…` or installed PWA) — confirm no toast at idle.
2. Trigger an update (new deploy, or DevTools → Application → Service Workers → “Update” after bumping a precached asset).
3. Expect: **“Updating…”** bottom-center → reload within ~3s.
4. Open management (`/displays`) in another tab — expect **no toast**; page should not forced-reload mid-edit when SW activates quietly.

- [ ] **Step 2: Final commit only if docs/comments needed**

If anything drifted from the design spec during implementation, update `docs/superpowers/specs/2026-07-15-pwa-display-update-toast-design.md` in a small docs commit. Otherwise skip.

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|------------------|------|
| `registerType: 'prompt'` | Task 2 |
| 30‑minute poll | Task 1 (`registerPwaUpdates` / `onRegisteredSW`) |
| Display toast + 3s + `updateSW(true)` | Task 4 |
| Management `updateSW(false)` | Task 1 |
| Early display session flag | Task 3 |
| Preview uses toast path | Task 3 (`preview` → `setDisplaySession(true)`) + Task 4 |
| Viewer-local overlay, no Mantine notifications | Task 4 |
| DEV unregister unchanged | Task 2 |
| Unit tests for branching | Task 1 |

## Placeholder / Consistency Check

- Toast copy uses the ellipsis character **Updating…** consistently.
- Reload delay constant: `3000` ms.
- Coordinator APIs named `setDisplaySession`, `subscribeToPendingUpdate`, `applyUpdate`, `registerPwaUpdates` throughout.
- No push/version-ping work in this plan (out of scope).
