# PWA Display Update Toast Design

## Goal

When a new Homeslate version is published, the always-on Android Chrome PWA (kitchen tablet / display viewer) should pick it up within the existing update poll window, show a brief “Updating…” toast, then reload into the new version. Management UI (phone/laptop editors) should not show that toast.

## Decisions

| Topic | Choice |
|-------|--------|
| Update UX | Toast, then auto-reload after a short delay |
| Poll interval | Keep ~30 minutes (existing) |
| Toast scope | Display / viewer sessions only |
| Approach | `registerType: 'prompt'` + app-controlled `updateSW` |
| Management update | Quiet activate (`updateSW(false)`), no toast, no forced reload |
| Toast delay | ~3 seconds after toast appears |
| Toast copy | “Updating…” |
| Toast UI | Viewer-local overlay (no `@mantine/notifications` dependency) |
| Preview mode | Same as display (toast + reload) when `DisplayViewer` is mounted |

## Chosen Approach

Keep `vite-plugin-pwa` and the production registration + 30‑minute `registration.update()` poll in `main.tsx`, but switch from `autoUpdate` to `prompt` so the page decides when the waiting service worker takes control.

On `onNeedRefresh`:

- **Display / viewer** (`DisplayViewer` mounted): show bottom-center “Updating…” toast → wait ~3s → `updateSW(true)` (activate + reload).
- **Management**: `updateSW(false)` (activate new SW without toast or forced reload; next full load runs the new app).

A small `pwaUpdate` module owns registration, polling, display-session registration, and the update callback. `DisplayViewer` mounts/unmounts the display-session flag and renders the toast overlay.

Rejected alternatives:

- **Keep `autoUpdate` + toast on `controllerchange`** — reload races the toast; management still hard-reloads silently with no control.
- **External version ping / push** — extra infra; service worker still required for cached assets; unnecessary given a 30‑minute poll.

## Architecture

```text
vite.config.ts  registerType: 'prompt'
        │
        ▼
main.tsx  →  pwaUpdate.register()
                ├─ registerSW({ onNeedRefresh })
                ├─ 30 min registration.update() poll
                └─ onNeedRefresh:
                     ├─ display session? → notify subscribers (toast path)
                     └─ else            → updateSW(false)

DisplayViewer
  ├─ markDisplaySession(true) on mount / false on unmount
  ├─ subscribe → show Updating toast → delay → updateSW(true)
  └─ toast overlay (bottom-center)
```

### Modules

| Module | Responsibility |
|--------|----------------|
| `vite.config.ts` | `registerType: 'prompt'` |
| `src/pwaUpdate.ts` | SW register, poll, display-session flag, `subscribe` / `applyUpdate` |
| `src/main.tsx` | Call register in prod; keep existing destale of SW in DEV |
| `DisplayViewer` (+ small overlay component or inline UI) | Claim display session; toast + delayed reload |

### Display detection

A session is “display” once the app has resolved that this tab will show a viewer: early flag when `resolveDisplayId()` (or preview) selects a display, and while `DisplayViewer` is mounted. That covers `?display=` / restored display id and in-app preview. Everything else is management.

## Edge Cases

- Offline or failed SW fetch during poll: ignore (same as today).
- Update available before React paints `DisplayViewer`: mark the display session as early as `App` resolves a display id (`resolveDisplayId()` / preview), before waiting on the viewer mount, so the first `onNeedRefresh` still takes the toast path on kitchen tablets. If there is still no display session, quiet-activate.
- Pending update while switching into viewer: if an update is already waiting and a display session becomes active, run the toast path once (do not quiet-activate again).
- Multiple tabs: each tab follows its own path independently.
- Dev mode: continue unregistering any leftover production SW (unchanged).

## Testing

- Unit: display vs management branching given a mocked update callback / session flag.
- Manual: after deploy (or forced `registration.update()`), kitchen display PWA shows toast and reloads within ~3s once the update is detected; management tab shows no toast.

## Out of Scope

- Push notifications or Netlify deploy hooks to wake the tablet faster than 30 minutes.
- OS-level Android notification permission prompts.
- Changing cache strategies / Workbox runtime caching rules.
