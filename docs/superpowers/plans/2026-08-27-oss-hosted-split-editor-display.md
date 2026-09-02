# OSS Hosted Split — Phase 4: Editor And Display Packages Implementation Plan

> **Status: complete** (merged to `main` at `902e6c0`, 2026-09-02). Tasks 1–7 shipped: `@homeslate/editor`, `@homeslate/display`, `@homeslate/display/canvas`, host wrappers. Follow-up cleanup (dead shims, `findAvailablePosition`, single `HolidayId`) is in later commits on this extraction.

> **For agentic workers:** This plan is done. Do not re-execute. Phase 5 is next. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Split the view editor and kiosk viewer into `@homeslate/editor` and `@homeslate/display` that both take a `DisplayDocument`, then make the current Vite app a host that imports both (still one deployable).

**Architecture:** `@homeslate/display` owns kiosk playback (rotation, holiday effects, alarm runtime) and a `./canvas` subpath for the shared document renderer (grid, widget chrome, sticky notes, slideshow, theme apply). `@homeslate/editor` depends on that canvas and adds widget-add, background settings, and theme-editor chrome. The host keeps Auth, routing, SaaS display list, pairing, passcodes, Netlify polling/PATCH, and `dashboardStore`; it converts store/API legacy `layouts` ↔ `DisplayDocument` with the existing bridge and wraps both packages in `HostGoogleRuntime`.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 3, npm workspaces, Vite 7, Mantine 8, react-grid-layout, existing CSS modules.

**Spec:** `docs/superpowers/specs/2026-08-27-oss-hosted-split-design.md`

## Global Constraints

- Editor and display take `{ document, onChange?, widgetRegistry }`. `onChange` is optional (kiosk may omit it). `widgetRegistry` is optional and defaults to `@homeslate/widgets` `getWidgetByType` / `getWidgetTypes`.
- Host wraps editor and display in `GoogleRuntime` (access token for the editor session, `kioskFetchBaseUrl` for the display). Neither package imports `AuthContext`, `apiClient`, `dashboardStore`, Neon, Netlify, or a database.
- `@homeslate/editor` does not contain accounts, display list as a SaaS concept, or billing.
- `@homeslate/display` does not contain pairing-as-onboarding or passcodes as a product. PIN poll/gate stays in the host `DisplayViewer` wrapper.
- Unknown widget `type`s render `UnknownWidget` (already in `WidgetWrapper`).
- Do not greenfield-rewrite JSX. Carve by `git mv` + import retarget. Do not change Google Calendar widget UX.
- Alarm *runtime* (`AlarmRuntime`, dialog, runtime `tones.ts`, `schedule.ts`, `alertQueue.ts`, `src/voice/*`) moves into `@homeslate/display`. `AlarmsProvider` / `AlarmListEditor` stay in `@homeslate/widgets`.
- Do not add a seventh public package. Shared renderer lives at `@homeslate/display/canvas` (same subpath pattern as `@homeslate/widgets/schemas`).
- Do not extract DisplayDetailPage document-setting toggles (sticky/voice/holidays/rotation/alarms list) this phase — they stay host chrome that writes the document via the store. Theme editor *does* move because it is already a props-driven component.
- Do not rename `layouts` inside `dashboardStore` this phase. Host converts at the package boundary via `migrateDisplayDocument` / `toLegacyConfig`.
- No billing, quota, or Homeslate-account code in `@homeslate/editor` or `@homeslate/display`.
- MIT public packages; both are public-core.
- The existing Vite app remains one deployable. Do not start Phase 5 (`adapters` / `apps/reference`) in this plan.

## Plan series (this file is Phase 4 only)

Phases 1–4 are done. Do not start Phase 5 until a Phase 5 plan is written.

| Phase | Plan file | Delivers |
|---|---|---|
| 1 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-schema.md` (done) | `@homeslate/schema`, v0→v1, live API persists v1 |
| 2 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-google.md` (done) | `@homeslate/google`, thin Netlify wrappers |
| 3 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-widgets.md` (done) | `@homeslate/widgets` + `registerWidget()` + built-in `configSchema`s |
| 4 | this file (done) | `@homeslate/editor` + `@homeslate/display` |
| 5 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-adapters-reference.md` | `@homeslate/adapters` + `apps/reference` |
| 6 | not written yet | hosted entitlements + private repo split |

## Why canvas is a display subpath

Editor, kiosk, and theme-preview all mount the same grid (`Dashboard` + `WidgetWrapper` + `StickyNote` + `BackgroundSlideshow`) plus theme apply (`resolveTheme` / `themeToVars`). Spec packages are `editor` and `display` only. Widgets must not grow an app shell. Putting the canvas on `@homeslate/display/canvas` lets editor import the renderer without importing kiosk rotation, holidays, or alarm runtime, and avoids a package the spec does not name.

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/display/package.json` | `@homeslate/display`; exports `.` and `./canvas` |
| `packages/display/src/index.ts` | Kiosk `Display` + alarm runtime re-exports |
| `packages/display/src/canvas/index.ts` | `DocumentCanvas`, slideshow, sticky notes, theme apply, document patches |
| `packages/display/src/canvas/DocumentCanvas.tsx` | Moved `Dashboard`; props-only, no zustand |
| `packages/display/src/canvas/WidgetWrapper.tsx` | Moved widget chrome; callbacks instead of store |
| `packages/display/src/canvas/StickyNote.tsx` | Moved sticky note UI |
| `packages/display/src/canvas/BackgroundSlideshow.tsx` | Moved; reads `View.background` |
| `packages/display/src/canvas/patchDocument.ts` | Immutable `DisplayDocument` patches |
| `packages/display/src/canvas/theme/*` | Moved resolver, defaults, utils, mantine bridge, palettes |
| `packages/display/src/Display.tsx` | Kiosk shell from `{ document, onChange? }` |
| `packages/display/src/HolidayEffects.tsx` | Moved holiday overlay |
| `packages/display/src/holidays.ts` | Moved holiday registry |
| `packages/display/src/viewRotationClock.ts` | Moved rotation clock |
| `packages/display/src/alarms/*` | Moved alarm runtime |
| `packages/display/src/voice/*` | Moved voice dismiss/snooze |
| `packages/editor/package.json` | `@homeslate/editor`; depends on schema, widgets, display |
| `packages/editor/src/index.ts` | `Editor`, `ThemeEditor` |
| `packages/editor/src/Editor.tsx` | View editor from `{ document, onChange?, viewId }` |
| `packages/editor/src/WidgetPanel.tsx` | Add-widget sidebar + `BgSettings` |
| `packages/editor/src/ThemeEditor.tsx` | Moved `ThemeDocumentManager` |
| `packages/editor/src/themeEditorModel.ts` | Moved token-edit helpers |
| `src/components/DisplayViewer.tsx` | Host: poll + PIN + `Display` |
| `src/pages/ViewEditorPage.tsx` | Host: auth chrome + autosave + `Editor` |
| `src/displayDocumentBridge.ts` | Add `displayRecordToDocument` / keep `toLegacyConfig` |
| `src/host/HostGoogleRuntime.tsx` | Unchanged host adapter |
| Shims under `src/components/*`, `src/themes/*`, `src/alarms/*` | Re-export from packages so leftover host imports compile |

Keep unchanged this plan: `src/contexts/AuthContext.tsx`, `src/pages/DisplayListPage.tsx`, pairing/invite/share/register modals, Netlify functions, `src/db`, `src/store/dashboardStore.ts` field names, `src/googleOAuthScopes.ts`, Home/Privacy/Terms.

---

### Task 1: Workspace And Package Entries

**Files:**
- Modify: `tsconfig.app.json`
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`
- Create: `packages/display/package.json`
- Create: `packages/display/src/index.ts`
- Create: `packages/display/src/canvas/index.ts`
- Create: `packages/editor/package.json`
- Create: `packages/editor/src/index.ts`
- Test: `packages/display/src/index.test.ts`
- Test: `packages/editor/src/index.test.ts`

**Interfaces:**
- Consumes: existing `workspaces: ["packages/*"]`
- Produces: `@homeslate/display`, `@homeslate/display/canvas`, `@homeslate/editor` importable constants

- [x] **Step 1: Write the failing tests**

Create `packages/display/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DISPLAY_PACKAGE_NAME } from '@homeslate/display';

describe('@homeslate/display', () => {
  it('is importable by package name', () => {
    expect(DISPLAY_PACKAGE_NAME).toBe('@homeslate/display');
  });
});
```

Create `packages/display/src/canvas/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DISPLAY_CANVAS_ENTRY } from '@homeslate/display/canvas';

describe('@homeslate/display/canvas', () => {
  it('is importable by subpath', () => {
    expect(DISPLAY_CANVAS_ENTRY).toBe('@homeslate/display/canvas');
  });
});
```

Create `packages/editor/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EDITOR_PACKAGE_NAME } from '@homeslate/editor';

describe('@homeslate/editor', () => {
  it('is importable by package name', () => {
    expect(EDITOR_PACKAGE_NAME).toBe('@homeslate/editor');
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/display/src/index.test.ts packages/display/src/canvas/index.test.ts packages/editor/src/index.test.ts`

Expected: FAIL — cannot resolve `@homeslate/display` / `@homeslate/display/canvas` / `@homeslate/editor`.

- [x] **Step 3: Create packages and wire resolution**

`packages/display/package.json`:

```json
{
  "name": "@homeslate/display",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./canvas": "./src/canvas/index.ts"
  },
  "dependencies": {
    "@homeslate/schema": "*",
    "@homeslate/widgets": "*",
    "@mantine/core": "^8.3.10",
    "@mantine/hooks": "^8.3.10",
    "@tabler/icons-react": "^3.35.0",
    "react-grid-layout": "^2.0.0",
    "uuid": "^13.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

`packages/display/src/index.ts`:

```ts
export const DISPLAY_PACKAGE_NAME = '@homeslate/display';
```

`packages/display/src/canvas/index.ts`:

```ts
export const DISPLAY_CANVAS_ENTRY = '@homeslate/display/canvas';
```

`packages/editor/package.json`:

```json
{
  "name": "@homeslate/editor",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@homeslate/display": "*",
    "@homeslate/schema": "*",
    "@homeslate/widgets": "*",
    "@mantine/core": "^8.3.10",
    "@mantine/hooks": "^8.3.10",
    "@tabler/icons-react": "^3.35.0",
    "uuid": "^13.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

`packages/editor/src/index.ts`:

```ts
export const EDITOR_PACKAGE_NAME = '@homeslate/editor';
```

`tsconfig.app.json` `paths` — add **canvas before display** (same reason widgets/schemas is before widgets):

```json
"@homeslate/display/canvas": ["packages/display/src/canvas/index.ts"],
"@homeslate/display": ["packages/display/src/index.ts"],
"@homeslate/editor": ["packages/editor/src/index.ts"]
```

Add `"packages/display/src"` and `"packages/editor/src"` to `include`.

`vite.config.ts` and `vitest.config.ts` aliases (canvas first):

```ts
"@homeslate/display/canvas": fileURLToPath(
  new URL("./packages/display/src/canvas/index.ts", import.meta.url)
),
"@homeslate/display": fileURLToPath(
  new URL("./packages/display/src/index.ts", import.meta.url)
),
"@homeslate/editor": fileURLToPath(
  new URL("./packages/editor/src/index.ts", import.meta.url)
),
```

`vitest.config.ts` `include` add:

```ts
"packages/display/src/**/*.test.ts",
"packages/editor/src/**/*.test.ts",
```

Run `npm install` at the repo root so workspace links exist.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/display/src/index.test.ts packages/display/src/canvas/index.test.ts packages/editor/src/index.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/display packages/editor tsconfig.app.json vite.config.ts vitest.config.ts package-lock.json
git commit -m "$(cat <<'EOF'
feat: add @homeslate/editor and @homeslate/display package entries

EOF
)"
```

---

### Task 2: Move Theme Apply Into Display Canvas

**Files:**
- Move: `src/themes/resolver.ts` → `packages/display/src/canvas/theme/resolver.ts`
- Move: `src/themes/resolver.test.ts` → `packages/display/src/canvas/theme/resolver.test.ts`
- Move: `src/themes/utils.ts` → `packages/display/src/canvas/theme/utils.ts`
- Move: `src/themes/utils.test.ts` → `packages/display/src/canvas/theme/utils.test.ts`
- Move: `src/themes/defaults.ts` → `packages/display/src/canvas/theme/defaults.ts`
- Move: `src/themes/defaults.test.ts` → `packages/display/src/canvas/theme/defaults.test.ts`
- Move: `src/themes/resolveDisplayThemeVars.ts` → `packages/display/src/canvas/theme/resolveDisplayThemeVars.ts`
- Move: `src/themes/resolveDisplayThemeVars.test.ts` → `packages/display/src/canvas/theme/resolveDisplayThemeVars.test.ts`
- Move: `src/themes/mantineBridge.ts` → `packages/display/src/canvas/theme/mantineBridge.ts`
- Move: `src/themes/tailwindPalette.ts` → `packages/display/src/canvas/theme/tailwindPalette.ts`
- Move: `src/themes/tailwindPalette.test.ts` → `packages/display/src/canvas/theme/tailwindPalette.test.ts`
- Move: `src/themes/index.test.ts` → `packages/display/src/canvas/theme/index.test.ts`
- Move: `src/themes/__snapshots__/` → `packages/display/src/canvas/theme/__snapshots__/`
- Move: `src/types/theme.ts` → `packages/display/src/canvas/theme/resolvedTypes.ts` (keep `ColorMode` import from schema)
- Modify: `packages/display/src/canvas/index.ts`
- Modify: `src/themes/index.ts` (shim)
- Modify: `src/types/theme.ts` (shim)
- Keep: `src/themes/themeDocumentValidation.ts` (already a schema shim)
- Keep in `src/themes/` until Task 7: `themeEditorModel.ts`, `themeEditorModel.test.ts`, `ThemePicker.tsx` is under components

**Interfaces:**
- Consumes: `ThemeDocument` from `@homeslate/schema`
- Produces: canvas exports `resolveTheme`, `themeToVars`, `resolveDisplayThemeVars`, `DEFAULT_THEME_DOCUMENTS`, `getPresetById`, `THEME_PRESET_OPTIONS`, `pickActiveDocument`, `mantineThemeFromResolved`, `TAILWIND_*` palette exports, `ResolvedTheme`

`packages/display/src/canvas/theme/resolvedTypes.ts` must keep today’s `ResolvedTheme` / `ThemeOverride` shapes from `src/types/theme.ts`, but import `ColorMode` and `ThemeDocument` from `@homeslate/schema` instead of `src/themes/themeDocumentValidation`.

- [x] **Step 1: Write the failing canvas re-export test**

Add to `packages/display/src/canvas/index.test.ts`:

```ts
import { resolveDisplayThemeVars } from '@homeslate/display/canvas';

it('exports resolveDisplayThemeVars', () => {
  const vars = resolveDisplayThemeVars([], null, 'dark');
  expect(vars['--token-surface-canvas']).toEqual(expect.any(String));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/display/src/canvas/index.test.ts`

Expected: FAIL — `resolveDisplayThemeVars` is not exported.

- [x] **Step 3: git mv theme apply and retarget imports**

```bash
mkdir -p packages/display/src/canvas/theme
git mv src/themes/resolver.ts packages/display/src/canvas/theme/resolver.ts
git mv src/themes/resolver.test.ts packages/display/src/canvas/theme/resolver.test.ts
git mv src/themes/utils.ts packages/display/src/canvas/theme/utils.ts
git mv src/themes/utils.test.ts packages/display/src/canvas/theme/utils.test.ts
git mv src/themes/defaults.ts packages/display/src/canvas/theme/defaults.ts
git mv src/themes/defaults.test.ts packages/display/src/canvas/theme/defaults.test.ts
git mv src/themes/resolveDisplayThemeVars.ts packages/display/src/canvas/theme/resolveDisplayThemeVars.ts
git mv src/themes/resolveDisplayThemeVars.test.ts packages/display/src/canvas/theme/resolveDisplayThemeVars.test.ts
git mv src/themes/mantineBridge.ts packages/display/src/canvas/theme/mantineBridge.ts
git mv src/themes/tailwindPalette.ts packages/display/src/canvas/theme/tailwindPalette.ts
git mv src/themes/tailwindPalette.test.ts packages/display/src/canvas/theme/tailwindPalette.test.ts
git mv src/themes/index.test.ts packages/display/src/canvas/theme/index.test.ts
git mv src/themes/__snapshots__ packages/display/src/canvas/theme/__snapshots__
git mv src/types/theme.ts packages/display/src/canvas/theme/resolvedTypes.ts
```

In moved files, replace `from "./themeDocumentValidation"` and `from "../themes/themeDocumentValidation"` with `from "@homeslate/schema"`. Replace `from "../types/theme"` with `from "./resolvedTypes"`. `resolvedTypes.ts` imports `ColorMode` / `ThemeDocument` from `@homeslate/schema`.

`packages/display/src/canvas/index.ts` (append, keep `DISPLAY_CANVAS_ENTRY`):

```ts
export {
  DEFAULT_THEME_DOCUMENTS,
  THEME_PRESET_OPTIONS,
  getPresetById,
  pickActiveDocument,
} from './theme/defaults';
export { themeToVars, hexToRgb, getBackgroundStyle } from './theme/utils';
export { resolveDisplayThemeVars } from './theme/resolveDisplayThemeVars';
export { resolveTheme, ThemeResolutionError } from './theme/resolver';
export { mantineThemeFromResolved } from './theme/mantineBridge';
export {
  TAILWIND_COLOR_PALETTES,
  TAILWIND_COMPACT_COLOR_SWATCHES,
  TAILWIND_PALETTE_NAMES,
  TAILWIND_PALETTE_STEPS,
  tailwindPaletteToTokenGroup,
} from './theme/tailwindPalette';
export type { ResolvedTheme, ThemeOverride } from './theme/resolvedTypes';
export type { ColorMode } from '@homeslate/schema';
```

Replace `src/themes/index.ts` with a shim that re-exports the canvas theme API (same names as today, including `defaultThemeDocument`). Replace `src/types/theme.ts` with:

```ts
export type { ColorMode, ThemeDocument } from '@homeslate/schema';
export type { ResolvedTheme, ThemeOverride } from '@homeslate/display/canvas';
```

`src/themes/themeEditorModel.ts` still imports palettes from `./tailwindPalette` — add `src/themes/tailwindPalette.ts`:

```ts
export {
  TAILWIND_COLOR_PALETTES,
  TAILWIND_COMPACT_COLOR_SWATCHES,
  TAILWIND_PALETTE_NAMES,
  TAILWIND_PALETTE_STEPS,
  tailwindPaletteToTokenGroup,
} from '@homeslate/display/canvas';
```

`src/App.tsx` may keep `from './themes/mantineBridge'` — add shim `src/themes/mantineBridge.ts`:

```ts
export { mantineThemeFromResolved } from '@homeslate/display/canvas';
```

Fix relative imports inside moved tests so snapshots still resolve (vitest looks next to the test file; the `git mv` of `__snapshots__` handles that).

- [x] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run packages/display/src/canvas/index.test.ts packages/display/src/canvas/theme src/themes/themeEditorModel.test.ts
npx tsc -b --pretty false
```

Expected: PASS. Existing theme snapshots still match.

- [x] **Step 5: Commit**

```bash
git add packages/display src/themes src/types/theme.ts src/App.tsx
git commit -m "$(cat <<'EOF'
refactor: move theme apply into @homeslate/display/canvas

EOF
)"
```

---

### Task 3: DisplayDocument Patch Helpers

**Files:**
- Create: `packages/display/src/canvas/patchDocument.ts`
- Test: `packages/display/src/canvas/patchDocument.test.ts`
- Modify: `packages/display/src/canvas/index.ts`

**Interfaces:**
- Consumes: `DisplayDocument`, `View`, `WidgetInstance`, `StickyNote` from `@homeslate/schema`
- Produces:

```ts
export function patchView(
  document: DisplayDocument,
  viewId: string,
  patch: Partial<View>,
): DisplayDocument;

export function replaceViewWidgets(
  document: DisplayDocument,
  viewId: string,
  widgets: WidgetInstance[],
): DisplayDocument;

export function patchWidgetConfig(
  document: DisplayDocument,
  viewId: string,
  widgetId: string,
  config: Record<string, unknown>,
): DisplayDocument;

export function removeWidget(
  document: DisplayDocument,
  viewId: string,
  widgetId: string,
): DisplayDocument;

export function addWidget(
  document: DisplayDocument,
  viewId: string,
  widget: WidgetInstance,
): DisplayDocument;

export function patchViewNotes(
  document: DisplayDocument,
  viewId: string,
  notes: StickyNote[],
): DisplayDocument;

export function applyWidgetLayouts(
  document: DisplayDocument,
  viewId: string,
  layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>,
): DisplayDocument;
```

Unknown `viewId` / `widgetId` returns the same document reference (no throw). Patches do not mutate the input.

- [x] **Step 1: Write the failing tests**

Create `packages/display/src/canvas/patchDocument.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DisplayDocument, WidgetInstance } from '@homeslate/schema';
import {
  addWidget,
  applyWidgetLayouts,
  patchView,
  patchViewNotes,
  patchWidgetConfig,
  removeWidget,
  replaceViewWidgets,
} from './patchDocument';

const widget = (id: string, extra?: Partial<WidgetInstance>): WidgetInstance => ({
  id,
  type: 'clock',
  title: 'Clock',
  config: { showSeconds: true },
  layout: { x: 0, y: 0, w: 2, h: 2 },
  ...extra,
});

const doc = (): DisplayDocument => ({
  schemaVersion: 1,
  name: 'Kitchen',
  views: [
    {
      id: 'morning',
      name: 'Morning',
      columns: 12,
      rowHeight: 80,
      widgets: [widget('w1')],
      notes: [],
    },
  ],
  activeViewId: 'morning',
  rotation: { enabled: false, intervalMs: 30000 },
  themes: [],
  activeThemeId: null,
  settings: {},
});

describe('patchDocument', () => {
  it('patchView updates one view and leaves others intact', () => {
    const next = patchView(doc(), 'morning', { name: 'Dawn' });
    expect(next.views[0].name).toBe('Dawn');
    expect(next).not.toBe(doc());
  });

  it('patchWidgetConfig merges config on the matching widget', () => {
    const next = patchWidgetConfig(doc(), 'morning', 'w1', { showSeconds: false, extra: 1 });
    expect(next.views[0].widgets[0].config).toEqual({ showSeconds: false, extra: 1 });
  });

  it('removeWidget drops the widget from the view', () => {
    const next = removeWidget(doc(), 'morning', 'w1');
    expect(next.views[0].widgets).toEqual([]);
  });

  it('addWidget appends a widget', () => {
    const w2 = widget('w2');
    const next = addWidget(doc(), 'morning', w2);
    expect(next.views[0].widgets.map((w) => w.id)).toEqual(['w1', 'w2']);
  });

  it('applyWidgetLayouts updates x/y/w/h and preserves minW', () => {
    const start = addWidget(doc(), 'morning', widget('w2', { layout: { x: 2, y: 0, w: 2, h: 2, minW: 2 } }));
    const next = applyWidgetLayouts(start, 'morning', [
      { i: 'w1', x: 1, y: 1, w: 3, h: 3 },
      { i: 'w2', x: 4, y: 0, w: 2, h: 2 },
    ]);
    expect(next.views[0].widgets[0].layout).toMatchObject({ x: 1, y: 1, w: 3, h: 3 });
    expect(next.views[0].widgets[1].layout.minW).toBe(2);
  });

  it('patchViewNotes replaces notes on the view', () => {
    const notes = [{ id: 'n1', text: 'hi', x: 10, y: 10, color: 'yellow' }];
    const next = patchViewNotes(doc(), 'morning', notes);
    expect(next.views[0].notes).toEqual(notes);
  });

  it('unknown viewId returns the same document reference', () => {
    const start = doc();
    expect(patchView(start, 'missing', { name: 'x' })).toBe(start);
    expect(removeWidget(start, 'missing', 'w1')).toBe(start);
  });

  it('replaceViewWidgets swaps the widget list', () => {
    const next = replaceViewWidgets(doc(), 'morning', [widget('w9')]);
    expect(next.views[0].widgets.map((w) => w.id)).toEqual(['w9']);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/display/src/canvas/patchDocument.test.ts`

Expected: FAIL — `patchDocument` not found.

- [x] **Step 3: Write minimal implementation**

`packages/display/src/canvas/patchDocument.ts`:

```ts
import type { DisplayDocument, StickyNote, View, WidgetInstance } from '@homeslate/schema';

function mapView(
  document: DisplayDocument,
  viewId: string,
  fn: (view: View) => View,
): DisplayDocument {
  let found = false;
  const views = document.views.map((view) => {
    if (view.id !== viewId) return view;
    found = true;
    return fn(view);
  });
  if (!found) return document;
  return { ...document, views };
}

export function patchView(
  document: DisplayDocument,
  viewId: string,
  patch: Partial<View>,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({ ...view, ...patch }));
}

export function replaceViewWidgets(
  document: DisplayDocument,
  viewId: string,
  widgets: WidgetInstance[],
): DisplayDocument {
  return mapView(document, viewId, (view) => ({ ...view, widgets }));
}

export function patchWidgetConfig(
  document: DisplayDocument,
  viewId: string,
  widgetId: string,
  config: Record<string, unknown>,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({
    ...view,
    widgets: view.widgets.map((widget) =>
      widget.id === widgetId
        ? { ...widget, config: { ...widget.config, ...config } }
        : widget,
    ),
  }));
}

export function removeWidget(
  document: DisplayDocument,
  viewId: string,
  widgetId: string,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({
    ...view,
    widgets: view.widgets.filter((widget) => widget.id !== widgetId),
  }));
}

export function addWidget(
  document: DisplayDocument,
  viewId: string,
  widget: WidgetInstance,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({
    ...view,
    widgets: [...view.widgets, widget],
  }));
}

export function patchViewNotes(
  document: DisplayDocument,
  viewId: string,
  notes: StickyNote[],
): DisplayDocument {
  return mapView(document, viewId, (view) => ({ ...view, notes }));
}

export function applyWidgetLayouts(
  document: DisplayDocument,
  viewId: string,
  layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({
    ...view,
    widgets: view.widgets.map((widget) => {
      const next = layouts.find((item) => item.i === widget.id);
      if (!next) return widget;
      return {
        ...widget,
        layout: { ...widget.layout, x: next.x, y: next.y, w: next.w, h: next.h },
      };
    }),
  }));
}
```

Re-export these from `packages/display/src/canvas/index.ts`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/display/src/canvas/patchDocument.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/display/src/canvas/patchDocument.ts packages/display/src/canvas/patchDocument.test.ts packages/display/src/canvas/index.ts
git commit -m "$(cat <<'EOF'
feat: add DisplayDocument patch helpers on display canvas

EOF
)"
```

---

### Task 4: Prop-Driven Document Canvas

**Files:**
- Move: `src/components/Dashboard.tsx` + `.module.css` → `packages/display/src/canvas/`
- Move: `src/components/WidgetWrapper.tsx` + `.module.css` + `.module.test.ts` → `packages/display/src/canvas/`
- Move: `src/components/StickyNote.tsx` + `.module.css` → `packages/display/src/canvas/`
- Move: `src/components/BackgroundSlideshow.tsx` → `packages/display/src/canvas/`
- Modify: `src/pages/ViewEditorPage.tsx` (pass `view` + callbacks; stop relying on store inside Dashboard)
- Modify: `src/components/DisplayViewer.tsx` (pass `View` into canvas)
- Modify: `src/components/ThemeDocumentManager.tsx` (preview uses `View`)
- Modify: `src/displayDocumentBridge.ts` (add `displayRecordToDocument`)
- Create shims: `src/components/Dashboard.tsx`, `WidgetWrapper.tsx`, `StickyNote.tsx`, `BackgroundSlideshow.tsx`
- Test: source-scan that canvas files do not import `dashboardStore` / `AuthContext` / `apiClient`

**Interfaces:**
- Consumes: Task 3 patches; `View` / `WidgetInstance` from schema; `getWidgetByType` / `UnknownWidget` from widgets
- Produces:

```ts
export type WidgetRegistryApi = {
  getWidgetByType: (type: string) => import('@homeslate/widgets').WidgetRegistryEntry | undefined;
  getWidgetTypes: () => import('@homeslate/widgets').WidgetRegistryEntry[];
};

export function DocumentCanvas(props: {
  view: View;
  isEditing?: boolean;
  stickyNotesEnabled?: boolean;
  notesOverride?: StickyNote[];
  onAddNote?: (note: StickyNote) => void;
  onRemoveNote?: (noteId: string) => void;
  onUpdateNote?: (noteId: string, updates: Partial<StickyNote>) => void;
  onWidgetConfigChange?: (widgetId: string, config: Record<string, unknown>) => void;
  onLayoutChange?: (
    layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>,
  ) => void;
  onRemoveWidget?: (widgetId: string) => void;
  widgetRegistry?: WidgetRegistryApi;
}): JSX.Element;

export function BackgroundSlideshow(props: { view: View }): JSX.Element;
```

Rename the component to `DocumentCanvas` (export `Dashboard` as an alias from the host shim only). `WidgetWrapper` takes `onConfigChange` and `onRemove` callbacks; it must not import `useDashboardStore`. `BackgroundSlideshow` reads `view.background` (`image`, `imageSize`, `overlayOpacity`, `photos`, `intervalSeconds`) — not flat `backgroundImage*` fields.

Default `widgetRegistry` is `{ getWidgetByType, getWidgetTypes }` from `@homeslate/widgets`.

Host helper (add to `src/displayDocumentBridge.ts`):

```ts
import { migrateDisplayDocument, type DisplayDocument } from '@homeslate/schema';

export function displayRecordToDocument(raw: unknown): DisplayDocument {
  return migrateDisplayDocument(raw);
}
```

`raw` is the current store/API object (`layouts`, `activeLayoutId`, `rotationEnabled`, …). Tests: extend `src/displayDocumentBridge.test.ts` with one case that `displayRecordToDocument(v0).views[0].background?.image` equals the v0 `backgroundImage`.

- [x] **Step 1: Write the failing tests**

Add to `packages/display/src/canvas/index.test.ts`:

```ts
import { readFileSync } from 'node:fs';

it('DocumentCanvas source does not import hosted store or auth', () => {
  const source = readFileSync(new URL('./DocumentCanvas.tsx', import.meta.url), 'utf8');
  expect(source).not.toMatch(/dashboardStore/);
  expect(source).not.toMatch(/AuthContext/);
  expect(source).not.toMatch(/apiClient/);
});

it('WidgetWrapper source does not import dashboardStore', () => {
  const source = readFileSync(new URL('./WidgetWrapper.tsx', import.meta.url), 'utf8');
  expect(source).not.toMatch(/dashboardStore/);
});

it('BackgroundSlideshow reads View.background', () => {
  const source = readFileSync(new URL('./BackgroundSlideshow.tsx', import.meta.url), 'utf8');
  expect(source).toMatch(/view\.background/);
  expect(source).not.toMatch(/backgroundImage/);
});
```

Add to `src/displayDocumentBridge.test.ts`:

```ts
it('displayRecordToDocument maps v0 backgroundImage onto view.background.image', () => {
  const document = displayRecordToDocument(v0);
  expect(document.views[0].background?.image).toBe('https://example.com/bg.jpg');
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/display/src/canvas/index.test.ts src/displayDocumentBridge.test.ts`

Expected: FAIL — `DocumentCanvas.tsx` missing; `displayRecordToDocument` missing.

- [x] **Step 3: git mv, strip store, wire host**

```bash
git mv src/components/Dashboard.tsx packages/display/src/canvas/DocumentCanvas.tsx
git mv src/components/Dashboard.module.css packages/display/src/canvas/DocumentCanvas.module.css
git mv src/components/WidgetWrapper.tsx packages/display/src/canvas/WidgetWrapper.tsx
git mv src/components/WidgetWrapper.module.css packages/display/src/canvas/WidgetWrapper.module.css
git mv src/components/WidgetWrapper.module.test.ts packages/display/src/canvas/WidgetWrapper.module.test.ts
git mv src/components/StickyNote.tsx packages/display/src/canvas/StickyNote.tsx
git mv src/components/StickyNote.module.css packages/display/src/canvas/StickyNote.module.css
git mv src/components/BackgroundSlideshow.tsx packages/display/src/canvas/BackgroundSlideshow.tsx
```

Retarget CSS module imports inside the moved files.

`DocumentCanvas` changes from today’s `Dashboard`:
- Required prop `view: View` (delete `layoutId`, `externalLayouts`, and all `useDashboardStore` reads).
- `handleLayoutChange` calls `onLayoutChange?.(clamped)` instead of `store.updateAllWidgetLayouts`.
- Note add/remove/update call the callback props only (no editor-store fallback). If `onAddNote` is omitted, the add button is a no-op.
- Pass `widget` through as `WidgetInstance` (structurally the same as `WidgetDefinition`).
- Import CSS as `./DocumentCanvas.module.css`.

`WidgetWrapper`:
- Replace `useDashboardStore` with `onConfigChange: (config: Partial<WidgetConfig>) => void` and `onRemove?: () => void`.
- Lookup via `widgetRegistry?.getWidgetByType ?? getWidgetByType`.

`BackgroundSlideshow`:
- Prop `view: View`.
- `const background = view.background ?? {}` then `image`, `imageSize ?? 'cover'`, `overlayOpacity ?? 0.5`, `photos`, `intervalSeconds ?? 10`.

Host shims:

```ts
// src/components/Dashboard.tsx
export { DocumentCanvas as Dashboard } from '@homeslate/display/canvas';
// src/components/WidgetWrapper.tsx
export { WidgetWrapper } from '@homeslate/display/canvas';
// src/components/StickyNote.tsx
export { StickyNote } from '@homeslate/display/canvas';
// src/components/BackgroundSlideshow.tsx
export { BackgroundSlideshow } from '@homeslate/display/canvas';
```

`ViewEditorPage` must pass the selected layout converted to a `View`:

```ts
const document = displayRecordToDocument({
  name: display.name,
  layouts: display.layouts,
  activeLayoutId: display.activeLayoutId,
  rotationEnabled: display.rotationEnabled,
  rotationIntervalMs: display.rotationIntervalMs,
  themes: display.themes,
  activeThemeId: display.activeThemeId,
  colorMode: display.colorMode,
  stickyNotesEnabled: display.stickyNotesEnabled,
  voiceEnabled: display.voiceEnabled,
  holidayEffectsEnabled: display.holidayEffectsEnabled,
  holidayPreviewId: display.holidayPreviewId,
  alarms: display.alarms,
});
const schemaView = document.views.find((v) => v.id === view.id);
```

Then:

```tsx
<BackgroundSlideshow view={schemaView} />
<DocumentCanvas
  view={schemaView}
  isEditing
  stickyNotesEnabled={display.stickyNotesEnabled ?? false}
  onLayoutChange={(layouts) => useDashboardStore.getState().updateAllWidgetLayouts(layouts)}
  onWidgetConfigChange={(id, config) => useDashboardStore.getState().updateWidgetConfig(id, config)}
  onRemoveWidget={(id) => useDashboardStore.getState().removeWidget(id)}
  onAddNote={(note) => useDashboardStore.getState().addNote(view.id, note)}
  onRemoveNote={(id) => useDashboardStore.getState().removeNote(view.id, id)}
  onUpdateNote={(id, updates) => useDashboardStore.getState().updateNote(view.id, id, updates)}
/>
```

`DisplayViewer`: after loading legacy `config`, `const document = displayRecordToDocument(config)` and pass `document.views` into canvas (`BackgroundSlideshow view={schemaView}`). Keep existing notes/todos local state and PATCH callbacks; map `onWidgetConfigChange` / note callbacks the same way they work today.

`ThemeDocumentManager`: change `previewLayouts?: DashboardLayout[]` to still accept host layouts this task by converting each preview layout through `displayRecordToDocument({ layouts: previewLayouts, activeLayoutId: previewLayouts[0]?.id ?? null, rotationEnabled: false, rotationIntervalMs: 30000 })` inside the component, then pass `View` into `DocumentCanvas` / `BackgroundSlideshow`. Keep the public prop name `previewLayouts` until Task 7 so `ThemeDocumentManager.test.ts` still matches. Update the JSX import from `./Dashboard` to `@homeslate/display/canvas` `DocumentCanvas`. The existing source test `"uses the real dashboard surface for draft theme preview"` expects the string `Dashboard` — keep a local alias `const Dashboard = DocumentCanvas` in ThemeDocumentManager so that test still passes this task.

Export `DocumentCanvas`, `WidgetWrapper`, `StickyNote`, `BackgroundSlideshow`, `WidgetRegistryApi` from canvas `index.ts`.

- [x] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run packages/display/src/canvas src/displayDocumentBridge.test.ts src/components/ThemeDocumentManager.test.ts
npx tsc -b --pretty false
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/display src/components src/pages/ViewEditorPage.tsx src/displayDocumentBridge.ts src/displayDocumentBridge.test.ts
git commit -m "$(cat <<'EOF'
refactor: make document canvas props-driven and store-free

EOF
)"
```

---

### Task 5: Kiosk Display Package And Host Wrapper

**Files:**
- Move: `src/components/HolidayEffects.tsx` + `.module.css` → `packages/display/src/`
- Move: `src/holidays/registry.ts` → `packages/display/src/holidays.ts`
- Move: `src/components/viewRotationClock.ts` + `.test.ts` → `packages/display/src/`
- Move: `src/alarms/AlarmRuntime.tsx`, `AlarmDialog.tsx`, `AlarmDialog.module.css`, `tones.ts`, `schedule.ts`, `schedule.test.ts`, `alertQueue.ts`, `alertQueue.test.ts`, `alertTypes.ts` → `packages/display/src/alarms/`
- Move: `src/voice/*` → `packages/display/src/voice/`
- Create: `packages/display/src/Display.tsx` + move kiosk CSS from `DisplayViewer.module.css` (copy inner-viewer rules; host keeps PIN-screen rules)
- Modify: `packages/display/src/index.ts`
- Modify: `src/components/DisplayViewer.tsx` (poll + PIN + pass `document` into `Display`)
- Shims: `src/alarms/*` runtime files, `src/holidays/registry.ts`, `src/components/HolidayEffects.tsx`, `src/components/viewRotationClock.ts`
- Test: package source-scan + existing rotation/schedule/voice tests after move

**Interfaces:**
- Consumes: canvas `DocumentCanvas` / `BackgroundSlideshow` / `resolveDisplayThemeVars`; widgets `AlarmsProvider` / `TimersProvider`; Task 3 patches
- Produces:

```ts
export function Display(props: {
  document: DisplayDocument;
  onChange?: (next: DisplayDocument) => void;
  widgetRegistry?: WidgetRegistryApi;
  previewViewId?: string | null;
  forceRotation?: boolean;
  colorMode?: ColorMode;
  isPreview?: boolean;
}): JSX.Element;
```

`Display` owns: visible-view rotation (including `createViewRotationClock`), swipe/dots/color-mode toggle, slideshow, holiday effects, `DocumentCanvas` in view mode, `AlarmRuntime` (disabled when `isPreview`), `TimersProvider` / `AlarmsProvider`.

`Display` does **not** own: `apiClient`, passcode PIN UI, `displayId` fetching, `DisplayProvider`. Host continues to wrap with `DisplayProvider` + `HostGoogleRuntime` so widgets get `kioskFetchBaseUrl`.

When the user edits notes or todo config, `Display` calls `onChange` with `patchViewNotes` / `patchWidgetConfig`. Optimistic local debounce/PATCH stays in the host wrapper: host keeps the current notes/todos state machine, and its `onChange` handler both updates React state and PATCHes `/api/notes` or `/api/todos`. To avoid a double-render fight, host may keep passing `onChange` that only PATCHes while feeding `Display` a document whose views already have host’s optimistic notes/todo items merged in — same behavior as today’s `viewerNotesByLayout` / `viewerTodoItemsByKey`.

Carve `Display.tsx` from the inner tree of `DisplayViewer` after the PIN gate (`if (passcodeRequired)` stays host). Copy the dots/swipe/progress JSX; retarget `layouts` → `document.views`, `rotationEnabled` → `document.rotation.enabled`, `stickyNotesEnabled` → `document.settings.stickyNotesEnabled`, etc.

`AlarmRuntime` import paths: `../voice/useAlarmVoiceCommands` becomes `../voice/useAlarmVoiceCommands`. Widgets `useTimers` still comes from `@homeslate/widgets`.

Do **not** move `src/hooks/useWakeLock.ts`. Host `DisplayViewer` and `AppInner` keep calling it.

Do **not** move `src/hooks/useViewRotation.ts` (editor/store helper, unused by kiosk).

- [x] **Step 1: Write the failing tests**

Create `packages/display/src/index.test.ts` additions (keep the package-name test):

```ts
import { readFileSync } from 'node:fs';
import { Display } from '@homeslate/display';

it('exports Display', () => {
  expect(typeof Display).toBe('function');
});

it('Display source does not import hosted persistence or auth', () => {
  const source = readFileSync(new URL('./Display.tsx', import.meta.url), 'utf8');
  expect(source).not.toMatch(/AuthContext/);
  expect(source).not.toMatch(/apiClient/);
  expect(source).not.toMatch(/dashboardStore/);
  expect(source).not.toMatch(/passcode/);
  expect(source).not.toMatch(/PinInput/);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/display/src/index.test.ts`

Expected: FAIL — `Display` not exported / `Display.tsx` missing.

- [x] **Step 3: Move kiosk internals and add Display**

`git mv` the files listed above. Leave shims:

```ts
// src/holidays/registry.ts
export * from '@homeslate/display';
```

Re-export holiday helpers from `packages/display/src/index.ts` (`getActiveHoliday`, `getHolidayById`, `HOLIDAY_OPTIONS` — export whatever `registry.ts` already exports).

```ts
// src/alarms/AlarmRuntime.tsx
export { AlarmRuntime } from '@homeslate/display';
```

Same pattern for `schedule.ts` (`coerceAlarms`, `findDueAlarms`, …), `alertQueue.ts`, `alertTypes.ts`, `tones.ts` (runtime tones, not widgets’ `ALARM_TONE_OPTIONS`).

`src/alarms/types.ts` currently re-exports schema types + `ALARM_TONE_OPTIONS` + `SNOOZE_MINUTES`. Keep `SNOOZE_MINUTES` by re-exporting from `@homeslate/display` after moving the constant with the runtime (it lives in `src/alarms/types.ts` today — move `SNOOZE_MINUTES` into `packages/display/src/alarms/types.ts`).

Implement `Display` with the props above. Use `resolveDisplayThemeVars(document.themes as ThemeDocument[], document.activeThemeId, effectiveMode)` — `document.themes` is `unknown[]` in schema; cast via the existing theme candidate helper or `as ThemeDocument[]` matching today’s DisplayViewer.

Host `DisplayViewer`:
1. Keep poll, PIN, `DisplayProvider`, nested `HostGoogleRuntime`, wake lock.
2. `displayRecordToDocument(cfg)` after a successful fetch.
3. Merge optimistic notes/todos into that document before render (same loops as today).
4. Render `<Display document={merged} onChange={handleDocumentChange} isPreview={isPreview} previewViewId={previewLayoutId} forceRotation={forceRotation} colorMode={colorMode} />`.
5. `handleDocumentChange` diffs notes/todo items vs previous and reuses existing `writeNotes` / `writeTodos`.

Delete the inner kiosk JSX from `DisplayViewer` once `Display` owns it. Keep PIN JSX and CSS in `DisplayViewer.module.css`. Move kiosk root/dots/nav CSS into `packages/display/src/Display.module.css` (copy from the current module; leave PIN classes in the host file).

- [x] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run packages/display src/appSurface.test.ts src/displayPersistence.test.ts
npx tsc -b --pretty false
```

Expected: PASS. Moved `viewRotationClock`, `schedule`, `alertQueue`, `parseAlarmVoiceCommand` tests run from new paths (update `vitest include` already covers `packages/display/src/**/*.test.ts`). Add `"packages/display/src/**/*.test.ts"` if a moved test sits next to `.tsx` only — already included.

If a test file is `.test.ts` under `src/voice/`, after `git mv` it lives under `packages/display/src/voice/` and is picked up.

- [x] **Step 5: Commit**

```bash
git add packages/display src/components/DisplayViewer.tsx src/components/DisplayViewer.module.css src/alarms src/holidays src/voice src/components/HolidayEffects.tsx src/components/viewRotationClock.ts
git commit -m "$(cat <<'EOF'
feat: extract kiosk Display into @homeslate/display

EOF
)"
```

---

### Task 6: Editor Package And Host ViewEditorPage

**Files:**
- Create: `packages/editor/src/Editor.tsx` + `Editor.module.css` (move body styles from `ViewEditorPage.module.css`; host keeps header styles)
- Move: `src/components/WidgetPanel.tsx` + `.module.css` → `packages/editor/src/`
- Modify: `src/pages/ViewEditorPage.tsx` (hosted chrome only)
- Modify: `packages/editor/src/index.ts`
- Shim: `src/components/WidgetPanel.tsx`
- Test: editor source-scan + WidgetPanel no longer imports AuthContext / apiClient / dashboardStore

**Interfaces:**
- Consumes: canvas `DocumentCanvas`, `BackgroundSlideshow`, `resolveDisplayThemeVars`; widgets `getWidgetTypes`, `useGooglePhotos`, `loadStoredImage`, `useGoogleRuntime`, `AlarmsProvider`, `TimersProvider`; Task 3 `addWidget` / patches; schema `ViewBackground`
- Produces:

```ts
export function Editor(props: {
  document: DisplayDocument;
  onChange?: (next: DisplayDocument) => void;
  viewId: string;
  widgetRegistry?: WidgetRegistryApi;
  onUploadBackgroundPhoto?: (payload: {
    dataUrl?: string;
    url?: string;
    filename?: string;
  }) => Promise<{ key: string; filename: string }>;
  actions?: React.ReactNode;
}): JSX.Element;
```

`Editor` renders: background-settings button + optional `actions`, `WidgetPanel`, `BackgroundSlideshow`, `DocumentCanvas` (`isEditing`), `BgSettings` modal. It applies `resolveDisplayThemeVars` on its root. It does not render account avatar, sign out, breadcrumbs, or router.

`WidgetPanel` props:

```ts
export function WidgetPanel(props: {
  document: DisplayDocument;
  viewId: string;
  onChange?: (next: DisplayDocument) => void;
  widgetRegistry?: WidgetRegistryApi;
}): JSX.Element;
```

Adding a widget uses `widgetRegistry?.getWidgetTypes ?? getWidgetTypes`, `uuid` for id, default layout from the registry entry, then `addWidget` from canvas patches.

`BgSettings` props:

```ts
export function BgSettings(props: {
  view: View;
  updateBg: (patch: Partial<ViewBackground>) => void;
  onUploadBackgroundPhoto?: EditorProps['onUploadBackgroundPhoto'];
}): JSX.Element;
```

Replace `useAuth()` with `useGoogleRuntime()` (`isAuthenticated`, `isLoading`, `signIn`). Replace hardcoded `apiClient.post('/api/photo-upload')` with `onUploadBackgroundPhoto`. If `onUploadBackgroundPhoto` is omitted, hide the Upload tab and URL-upload path (URL-as-stored-photo needs the host upload helper); the Google Photos tab can still run because `useGooglePhotos` talks through `GoogleRuntime`. Keep the URL tab visible but show an inline error `"Photo upload is unavailable"` if the callback is missing when the user submits.

Map `View.background` ↔ UI:
- photos: `view.background?.photos ?? []`
- interval: `view.background?.intervalSeconds ?? 10`
- overlay: `view.background?.overlayOpacity ?? 0.5`
- `updateBg({ photos, intervalSeconds, overlayOpacity, image, imageSize })`

Do not import `DashboardLayout` in the editor package.

Host `ViewEditorPage`:
- Keep header (back, breadcrumbs, autosave icon, color mode, avatar/signOut) and Preview button.
- Keep the existing `useDashboardStore.subscribe` PUT `/api/config` autosave.
- `onChange` from `Editor` writes the document back onto the selected display via `toLegacyConfig` merged onto the current `Display` record (do not clobber `id`, `displayId`, `passcodeEnabled`, `isOwner`). Implement `applyDocumentToDisplay` in `src/displayDocumentBridge.ts`:

```ts
import type { DisplayDocument } from '@homeslate/schema';
import { toLegacyConfig } from './displayDocumentBridge'; // same file

export function applyDocumentToDisplay<T extends { id: string }>(
  display: T,
  document: DisplayDocument,
): T {
  const legacy = toLegacyConfig(document);
  return {
    ...display,
    name: document.name,
    layouts: legacy.layouts,
    activeLayoutId: legacy.activeLayoutId,
    rotationEnabled: legacy.rotationEnabled,
    rotationIntervalMs: legacy.rotationIntervalMs,
    themes: legacy.themes,
    activeThemeId: legacy.activeThemeId,
    colorMode: legacy.colorMode,
    stickyNotesEnabled: legacy.stickyNotesEnabled,
    voiceEnabled: legacy.voiceEnabled,
    holidayEffectsEnabled: legacy.holidayEffectsEnabled,
    holidayPreviewId: legacy.holidayPreviewId,
    alarms: legacy.alarms,
  };
}
```

Host then `set({ displays: displays.map(...) })` using existing store `set` patterns — call a small function in `ViewEditorPage` that uses `useDashboardStore.setState`. Do not add new store methods unless a one-liner `setState` is insufficient; prefer `setState` to avoid a dashboardStore redesign.

Pass `onUploadBackgroundPhoto` that calls today’s `apiClient.post('/api/photo-upload', { body: payload })`.

Pass `actions={<Button Preview This View .../>}`.

- [x] **Step 1: Write the failing tests**

`packages/editor/src/index.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EDITOR_PACKAGE_NAME, Editor } from '@homeslate/editor';

describe('@homeslate/editor', () => {
  it('is importable by package name', () => {
    expect(EDITOR_PACKAGE_NAME).toBe('@homeslate/editor');
  });

  it('exports Editor', () => {
    expect(typeof Editor).toBe('function');
  });

  it('Editor source does not import hosted auth, api, or store', () => {
    const source = readFileSync(new URL('./Editor.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/AuthContext/);
    expect(source).not.toMatch(/apiClient/);
    expect(source).not.toMatch(/dashboardStore/);
    expect(source).not.toMatch(/react-router/);
  });

  it('WidgetPanel source does not import hosted auth, api, or store', () => {
    const source = readFileSync(new URL('./WidgetPanel.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/AuthContext/);
    expect(source).not.toMatch(/apiClient/);
    expect(source).not.toMatch(/dashboardStore/);
    expect(source).toMatch(/useGoogleRuntime/);
  });
});
```

Add `src/displayDocumentBridge.test.ts` case:

```ts
it('applyDocumentToDisplay copies document fields and preserves host id', () => {
  const document = displayRecordToDocument(v0);
  document.name = 'Renamed';
  const next = applyDocumentToDisplay({ id: 'host-1', displayId: 'pub-1', passcodeEnabled: true }, document);
  expect(next.id).toBe('host-1');
  expect(next.displayId).toBe('pub-1');
  expect(next.passcodeEnabled).toBe(true);
  expect(next.name).toBe('Renamed');
  expect(next.layouts[0].backgroundImage).toBe('https://example.com/bg.jpg');
});
```

(`v0` in the existing test already has `backgroundImage`; `toLegacyConfig` round-trips it.)

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/editor/src/index.test.ts src/displayDocumentBridge.test.ts`

Expected: FAIL — `Editor` not exported.

- [x] **Step 3: Implement Editor, retarget WidgetPanel, wrap host page**

`git mv` WidgetPanel. Strip `useDashboardStore` / `useAuth` / `apiClient`. Thread props as specified.

`Editor.tsx` looks like today’s `ViewEditorPage` body (`pageActions` without Preview unless `actions` provided, `body` with panel + main). Color mode stays in the host header.

Leave `AddWidgetPanel` in `src/` (unused page; still store-based). Do not move it.

- [x] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run packages/editor/src/index.test.ts packages/display/src/canvas/patchDocument.test.ts src/displayDocumentBridge.test.ts
npx tsc -b --pretty false
```

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/editor src/pages/ViewEditorPage.tsx src/pages/ViewEditorPage.module.css src/components/WidgetPanel.tsx src/displayDocumentBridge.ts src/displayDocumentBridge.test.ts
git commit -m "$(cat <<'EOF'
feat: extract document Editor into @homeslate/editor

EOF
)"
```

---

### Task 7: Theme Editor Package Surface And Host Import

**Files:**
- Move: `src/components/ThemeDocumentManager.tsx` + `.module.css` + `.test.ts` → `packages/editor/src/ThemeEditor.tsx` (and css/test)
- Move: `src/themes/themeEditorModel.ts` + `.test.ts` → `packages/editor/src/`
- Modify: `src/pages/DisplayDetailPage.tsx` (import `ThemeEditor` from `@homeslate/editor`)
- Modify: `packages/editor/src/index.ts`
- Shim: `src/components/ThemeDocumentManager.tsx` re-exports `ThemeEditor as ThemeDocumentManager`
- Test: theme editor source-scan; existing ThemeDocumentManager markup tests after path/name updates

**Interfaces:**
- Consumes: canvas `DocumentCanvas`, `BackgroundSlideshow`, `resolveTheme`, `themeToVars`, `getPresetById`, `THEME_PRESET_OPTIONS`, palette exports; schema `validateThemeDocument`
- Produces:

```ts
export function ThemeEditor(props: {
  documents: ThemeDocument[] | undefined;
  activeThemeDocumentId: string | null | undefined;
  previewViews?: View[];
  initialPreviewViewId?: string | null;
  onChange: (documents: ThemeDocument[], activeThemeDocumentId: string | null) => void;
}): JSX.Element;
```

Rename the component to `ThemeEditor`. Replace `previewLayouts?: DashboardLayout[]` with `previewViews?: View[]`. Update the source-scan tests that currently look for `previewLayouts` / `Dashboard`:
- expect `previewViews`
- expect `DocumentCanvas`
- keep the other markup contracts (token tabs, palettes, etc.)

DisplayDetailPage currently:

```tsx
<ThemeDocumentManager
  documents={display.themes}
  activeThemeDocumentId={display.activeThemeId}
  previewLayouts={visibleLayouts}
  ...
/>
```

Change to `ThemeEditor` + `previewViews={displayRecordToDocument({...}).views.filter(v => !v.hidden)}` (or convert `visibleLayouts` through `displayRecordToDocument`).

`themeEditorModel.ts` imports palettes from `@homeslate/display/canvas` (delete the Task 2 `src/themes/tailwindPalette.ts` shim if nothing else needs it; `ThemePicker.tsx` still imports `THEME_PRESET_OPTIONS` from `../themes` — keep `src/themes/index.ts` shim).

ThemeEditor must not import `AuthContext`, `apiClient`, or `dashboardStore`.

- [x] **Step 1: Write the failing tests**

Add to `packages/editor/src/index.test.ts`:

```ts
it('exports ThemeEditor', async () => {
  const { ThemeEditor } = await import('@homeslate/editor');
  expect(typeof ThemeEditor).toBe('function');
});

it('ThemeEditor source does not import hosted auth, api, or store', () => {
  const source = readFileSync(new URL('./ThemeEditor.tsx', import.meta.url), 'utf8');
  expect(source).not.toMatch(/AuthContext/);
  expect(source).not.toMatch(/apiClient/);
  expect(source).not.toMatch(/dashboardStore/);
  expect(source).toMatch(/previewViews/);
  expect(source).toMatch(/DocumentCanvas/);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/editor/src/index.test.ts`

Expected: FAIL — `ThemeEditor` not exported.

- [x] **Step 3: git mv and retarget**

Move files, rename component, switch preview prop to `View[]`, import canvas from `@homeslate/display/canvas`, validation from `@homeslate/schema`. Update DisplayDetailPage. Keep a host shim for the old name.

Move `ThemeDocumentManager.test.ts` next to `ThemeEditor.tsx` and update string assertions (`previewViews`, `DocumentCanvas`). CSS class names stay the same.

- [x] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run packages/editor packages/display src/displayDocumentBridge.test.ts src/themes/themeEditorModel.test.ts
npx tsc -b --pretty false
npx vitest run
```

`src/themes/themeEditorModel.test.ts` should have moved — run `packages/editor/src/themeEditorModel.test.ts` instead.

Full `npx vitest run` must pass. `npx tsc -b` must pass.

Final source-scan (add `packages/editor/src/hostImports.test.ts` and `packages/display/src/hostImports.test.ts` if not already covered): every `.ts`/`.tsx` under `packages/editor/src` and `packages/display/src` except tests must not match `/AuthContext|apiClient|dashboardStore|from ['"]neon|netlify/`. Implement as a small `readdirSync` walk so a future file cannot sneak hosted imports in.

- [x] **Step 5: Commit**

```bash
git add packages/editor packages/display src/pages/DisplayDetailPage.tsx src/components/ThemeDocumentManager.tsx src/themes
git commit -m "$(cat <<'EOF'
feat: move theme editor into @homeslate/editor

EOF
)"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| Split UI into `packages/editor` and `packages/display` | 1, 5, 6, 7 |
| Vite app becomes a host that imports both | 5, 6, 7 |
| `{ document, onChange?, widgetRegistry }` | 5, 6 |
| Editor: view editor, widget add/settings, theme editor chrome | 6, 7 |
| Display: kiosk, rotation, alarm runtime, holiday effects | 5 |
| Editor does not include accounts / display list / billing | 6, 7 source-scan |
| Display does not include pairing / passcodes | 5 PIN stays host |
| Host wraps `GoogleRuntime` | unchanged `HostGoogleRuntime`; BgSettings uses `useGoogleRuntime` in 6 |
| Neither package imports a database | source-scan Task 7 |
| Unknown `type` placeholder | canvas WidgetWrapper (Task 4) |
| Carve, do not rewrite | git mv in 2, 4, 5, 6, 7 |
| Alarm runtime in display | Task 5 |
| MIT, no entitlements in packages | Global constraints |
| Document settings toggles on DisplayDetailPage | Explicitly deferred (not in editor “does” list) |

**Placeholder scan:** no TBD / “handle edge cases” / “similar to Task N”.

**Type consistency:** `DisplayDocument` / `View` / `ViewBackground` from schema; `WidgetRegistryApi` defined in Task 4 and consumed in 5–6; `displayRecordToDocument` / `applyDocumentToDisplay` / `toLegacyConfig` are the host boundary in Tasks 4–6.

**YAGNI held:** no `@homeslate/canvas` package, no `DocumentSettings` extraction, no `dashboardStore` `layouts`→`views` rename, no `AddWidgetPanel` move, no wake-lock move, no reference app.
