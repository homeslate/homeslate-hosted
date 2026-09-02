# OSS Hosted Split — Phase 1: Schema Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `@homeslate/schema` with `DisplayDocument` types, v0→v1 migration, and validation, then persist v1 JSON in Neon while the current Vite UI keeps speaking the legacy `layouts` config shape.

**Architecture:** A new npm workspace package owns the portable document. Netlify functions migrate on read, validate on write, and store v1. A host-only bridge converts v1 back to `{ layouts, activeLayoutId, ... }` so `DisplayViewer`, the editor, todos, and notes keep working without a UI rewrite.

**Tech Stack:** TypeScript 5.9, Zod 4.3.6, Vitest 3, npm workspaces, Vite 7, existing Netlify functions + Neon jsonb `display_configs.config`.

**Spec:** `docs/superpowers/specs/2026-08-27-oss-hosted-split-design.md`

## Global Constraints

- Public schema uses `views` (today’s `layouts`); v1 writes persist `schemaVersion: 1`.
- Hosts run migrate on read so existing Neon rows keep working.
- `DisplayStore.put` / config PUT MUST reject invalid documents; kiosk GET must not 500 on messy historical JSON (migrate best-effort and serve).
- Unknown widget `type`s round-trip when `id`, `type`, `title`, `layout`, and object `config` are present.
- Built-in widget config schemas are registered next to widgets (later plan). This plan only adds `registerWidgetConfigSchema` so later packages can hook in.
- `ViewBackground.photos` must pass through existing `UrlPhoto` / `StoredPhoto` objects (do not collapse to `{ url, caption }`).
- No billing, quota, or Homeslate-account code in `@homeslate/schema`.
- Do not greenfield-rewrite the app. Do not rename `layouts` in React this plan.
- MIT public packages; this package is public-core.

## Plan series (this file is Phase 1 only)

The spec’s extraction sequence is six independently shippable plans. Execute this file first. Do not start Phase 2 until Phase 1 tests pass and the current app still loads displays.

| Phase | Plan file | Delivers |
|---|---|---|
| 1 | this file | `@homeslate/schema`, v0→v1, live API persists v1 |
| 2 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-google.md` | `@homeslate/google`, thin Netlify wrappers |
| 3 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-widgets.md` (done) | `@homeslate/widgets` + `registerWidget()` + built-in `configSchema`s |
| 4 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-editor-display.md` | `@homeslate/editor` + `@homeslate/display` |
| 5 | not written yet | `@homeslate/adapters` + `apps/reference` |
| 6 | not written yet | hosted entitlements + private repo split |

## File Structure

| File | Responsibility |
|------|----------------|
| `package.json` (root) | Add `workspaces: ["packages/*"]` |
| `packages/schema/package.json` | `@homeslate/schema` package manifest |
| `packages/schema/src/index.ts` | Public exports |
| `packages/schema/src/types.ts` | `DisplayDocument`, `View`, `WidgetInstance`, alarms, holiday ids |
| `packages/schema/src/migrate.ts` | `migrateDisplayDocument(raw)` |
| `packages/schema/src/validate.ts` | `validateDisplayDocument`, `registerWidgetConfigSchema` |
| `packages/schema/src/themeDocumentValidation.ts` | Moved from `src/themes/themeDocumentValidation.ts` |
| `packages/schema/schemas/theme-document.schema.json` | Moved from `schemas/theme-document.schema.json` |
| `packages/schema/src/migrate.test.ts` | Golden v0/v1 migrator tests |
| `packages/schema/src/validate.test.ts` | Structural + unknown-type + registry tests |
| `src/displayDocumentBridge.ts` | `readStoredConfig` / `writeStoredConfig` / `toLegacyConfig` |
| `src/displayDocumentBridge.test.ts` | Bridge tests |
| `src/themes/themeDocumentValidation.ts` | Re-export shim from `@homeslate/schema` |
| Modify: `vitest.config.ts` | Include `packages/schema/src/**/*.test.ts` |
| Modify: `tsconfig.app.json` | `paths` for `@homeslate/schema` |
| Modify: `vite.config.ts` | Alias `@homeslate/schema` |
| Modify: `netlify/functions/config.ts` | Validate + persist v1 |
| Modify: `netlify/functions/display.ts` | Migrate on read, respond with legacy shape |
| Modify: `netlify/functions/displays.ts` | Same as display GET for list payloads |
| Modify: `netlify/functions/todos.ts` | Migrate, patch `views`, persist v1 |
| Modify: `netlify/functions/notes.ts` | Migrate, patch `views`, persist v1 |

---

### Task 1: Workspace And Schema Package Entry

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.app.json`
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`
- Create: `packages/schema/package.json`
- Create: `packages/schema/src/index.ts`
- Test: `packages/schema/src/index.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: package `@homeslate/schema` importable from app tests and Vite as `export const SCHEMA_PACKAGE_NAME = '@homeslate/schema'`

- [ ] **Step 1: Write the failing test**

Create `packages/schema/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SCHEMA_PACKAGE_NAME } from '@homeslate/schema';

describe('@homeslate/schema', () => {
  it('is importable by package name', () => {
    expect(SCHEMA_PACKAGE_NAME).toBe('@homeslate/schema');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/schema/src/index.test.ts`

Expected: FAIL — cannot resolve `@homeslate/schema` (or file not in vitest include).

- [ ] **Step 3: Create the package and wire resolution**

`packages/schema/package.json`:

```json
{
  "name": "@homeslate/schema",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

`packages/schema/src/index.ts`:

```ts
export const SCHEMA_PACKAGE_NAME = '@homeslate/schema';
```

In root `package.json`, add next to `"private": true`:

```json
"workspaces": ["packages/*"],
```

In `tsconfig.app.json` `compilerOptions`, add:

```json
"baseUrl": ".",
"paths": {
  "@homeslate/schema": ["packages/schema/src/index.ts"]
}
```

Change `"include"` to:

```json
"include": ["src", "packages/schema/src"]
```

In `vite.config.ts`, add the Node imports at the top (alongside the existing imports):

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
```

Inside the config object returned by `defineConfig`, add:

```ts
resolve: {
  alias: {
    '@homeslate/schema': fileURLToPath(
      new URL('./packages/schema/src/index.ts', import.meta.url)
    ),
  },
},
```

In `vitest.config.ts`, change `test.include` to:

```ts
include: ["src/**/*.test.ts", "src/**/*.test.tsx", "packages/schema/src/**/*.test.ts"],
```

Add the same Vite alias to `vitest.config.ts` (copy the `resolve.alias` block and the `path`/`fileURLToPath` imports). Vitest uses this file, not `vite.config.ts`.

Run: `npm install`

Expected: `node_modules/@homeslate/schema` symlink exists.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/schema/src/index.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.app.json vite.config.ts vitest.config.ts packages/schema
git commit -m "chore: add @homeslate/schema workspace package"
```

---

### Task 2: DisplayDocument Types And v0→v1 Migrator

**Files:**
- Create: `packages/schema/src/types.ts`
- Create: `packages/schema/src/migrate.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/src/migrate.test.ts`

**Interfaces:**
- Consumes: `SCHEMA_PACKAGE_NAME` from Task 1
- Produces:
  - `export type DisplayDocument`, `View`, `ViewBackground`, `WidgetInstance`, `WidgetLayout`, `StickyNote`, `AlarmDefinition`, `AlarmToneId`, `HolidayId`, `ColorMode`
  - `export function migrateDisplayDocument(raw: unknown): DisplayDocument`
  - Default rotation interval `30000` when v0 omits `rotationIntervalMs`
  - Default `name` `'Homeslate'` when v0 omits `name`

- [ ] **Step 1: Write the failing tests**

Create `packages/schema/src/migrate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { migrateDisplayDocument } from './migrate';

const v0Kitchen = {
  layouts: [
    {
      id: 'view-1',
      name: 'Morning',
      icon: 'IconHome',
      hidden: false,
      columns: 12,
      rowHeight: 80,
      widgets: [
        {
          id: 'w-clock',
          type: 'clock',
          title: 'Clock',
          config: { showSeconds: true, timezone: 'local' },
          layout: { x: 0, y: 0, w: 3, h: 2 },
        },
        {
          id: 'w-custom',
          type: 'my-custom',
          title: 'Custom',
          config: { foo: 'bar' },
          layout: { x: 3, y: 0, w: 2, h: 2, minW: 1 },
        },
      ],
      backgroundImage: 'https://example.com/bg.jpg',
      backgroundImageSize: 'cover',
      backgroundOverlayOpacity: 0.4,
      backgroundPhotos: [
        { type: 'url', url: 'https://example.com/a.jpg', caption: 'A' },
        { type: 'stored', key: 'blob-1', filename: 'pic.png' },
      ],
      backgroundInterval: 12,
      notes: [{ id: 'n1', text: 'Buy milk', x: 10, y: 20, color: 'yellow' }],
    },
  ],
  activeLayoutId: 'view-1',
  rotationEnabled: true,
  rotationIntervalMs: 15000,
  colorMode: 'dark',
  stickyNotesEnabled: true,
  voiceEnabled: false,
  holidayEffectsEnabled: true,
  holidayPreviewId: 'halloween',
  alarms: [
    {
      id: 'a1',
      label: 'Dinner',
      enabled: true,
      time: '19:00',
      days: [1, 2, 3, 4, 5],
      toneId: 'chime',
    },
  ],
  themes: [{ id: 't1', name: 'Default', version: 1, isActive: true, tokens: {} }],
  activeThemeId: 't1',
};

describe('migrateDisplayDocument', () => {
  it('maps v0 layouts to v1 views and nests settings', () => {
    const doc = migrateDisplayDocument(v0Kitchen);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.name).toBe('Homeslate');
    expect(doc.activeViewId).toBe('view-1');
    expect(doc.rotation).toEqual({ enabled: true, intervalMs: 15000 });
    expect(doc.colorMode).toBe('dark');
    expect(doc.settings).toEqual({
      stickyNotesEnabled: true,
      voiceEnabled: false,
      holidayEffectsEnabled: true,
      holidayPreviewId: 'halloween',
    });
    expect(doc.alarms).toEqual(v0Kitchen.alarms);
    expect(doc.activeThemeId).toBe('t1');
    expect(doc.views).toHaveLength(1);
    const view = doc.views[0];
    expect(view.id).toBe('view-1');
    expect(view.name).toBe('Morning');
    expect(view.icon).toBe('IconHome');
    expect(view.hidden).toBe(false);
    expect(view.columns).toBe(12);
    expect(view.rowHeight).toBe(80);
    expect(view.notes).toEqual(v0Kitchen.layouts[0].notes);
    expect(view.background).toEqual({
      image: 'https://example.com/bg.jpg',
      imageSize: 'cover',
      overlayOpacity: 0.4,
      photos: v0Kitchen.layouts[0].backgroundPhotos,
      intervalSeconds: 12,
    });
    expect(view.widgets[0].type).toBe('clock');
    expect(view.widgets[1].type).toBe('my-custom');
    expect(view.widgets[1].config).toEqual({ foo: 'bar' });
    expect(view.widgets[1].layout.minW).toBe(1);
  });

  it('preserves stored background photos instead of collapsing to url+caption', () => {
    const doc = migrateDisplayDocument(v0Kitchen);
    const photos = doc.views[0].background?.photos;
    expect(photos?.[1]).toEqual({ type: 'stored', key: 'blob-1', filename: 'pic.png' });
  });

  it('defaults rotation interval and empty views for a bare object', () => {
    const doc = migrateDisplayDocument({});
    expect(doc).toEqual({
      schemaVersion: 1,
      name: 'Homeslate',
      views: [],
      activeViewId: null,
      rotation: { enabled: false, intervalMs: 30000 },
      themes: [],
      activeThemeId: null,
      settings: {},
    });
  });

  it('is identity for v1 documents', () => {
    const v1 = migrateDisplayDocument(v0Kitchen);
    const again = migrateDisplayDocument(v1);
    expect(again).toEqual(v1);
  });

  it('uses document.name when present on v0', () => {
    const doc = migrateDisplayDocument({ ...v0Kitchen, name: 'Kitchen' });
    expect(doc.name).toBe('Kitchen');
  });

  it('throws on non-object input', () => {
    expect(() => migrateDisplayDocument(null)).toThrow(/plain object/);
    expect(() => migrateDisplayDocument([])).toThrow(/plain object/);
    expect(() => migrateDisplayDocument('nope')).toThrow(/plain object/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/schema/src/migrate.test.ts`

Expected: FAIL with `Cannot find module './migrate'` (or `migrateDisplayDocument` is not exported).

- [ ] **Step 3: Write types and migrator**

Create `packages/schema/src/types.ts`:

```ts
export type ColorMode = 'dark' | 'light';

export type HolidayId =
  | 'new-years-day'
  | 'valentines-day'
  | 'st-patricks-day'
  | 'independence-day'
  | 'halloween'
  | 'thanksgiving'
  | 'christmas'
  | 'new-years-eve';

export type AlarmToneId = 'chime' | 'bell' | 'radar';

export type AlarmDefinition = {
  id: string;
  label: string;
  enabled: boolean;
  time: string;
  days: number[];
  toneId: AlarmToneId;
};

export type StickyNote = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
};

export type WidgetLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

export type WidgetInstance = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  layout: WidgetLayout;
};

export type ViewBackground = {
  image?: string;
  imageSize?: 'cover' | 'contain' | 'tile';
  overlayOpacity?: number;
  photos?: unknown[];
  intervalSeconds?: number;
};

export type View = {
  id: string;
  name: string;
  icon?: string;
  hidden?: boolean;
  columns: number;
  rowHeight: number;
  widgets: WidgetInstance[];
  background?: ViewBackground;
  notes?: StickyNote[];
};

export type DisplayDocument = {
  schemaVersion: 1;
  name: string;
  views: View[];
  activeViewId: string | null;
  rotation: { enabled: boolean; intervalMs: number };
  themes: unknown[];
  activeThemeId: string | null;
  colorMode?: ColorMode;
  settings: {
    stickyNotesEnabled?: boolean;
    voiceEnabled?: boolean;
    holidayEffectsEnabled?: boolean;
    holidayPreviewId?: HolidayId;
  };
  alarms?: AlarmDefinition[];
};
```

Create `packages/schema/src/migrate.ts`:

```ts
import type {
  AlarmDefinition,
  ColorMode,
  DisplayDocument,
  HolidayId,
  StickyNote,
  View,
  ViewBackground,
  WidgetInstance,
  WidgetLayout,
} from './types';

const DEFAULT_ROTATION_MS = 30000;
const DEFAULT_NAME = 'Homeslate';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function migrateLayout(raw: unknown): WidgetLayout {
  const o = isPlainObject(raw) ? raw : {};
  return {
    x: asNumber(o.x) ?? 0,
    y: asNumber(o.y) ?? 0,
    w: asNumber(o.w) ?? 1,
    h: asNumber(o.h) ?? 1,
    ...(asNumber(o.minW) !== undefined ? { minW: o.minW as number } : {}),
    ...(asNumber(o.minH) !== undefined ? { minH: o.minH as number } : {}),
    ...(asNumber(o.maxW) !== undefined ? { maxW: o.maxW as number } : {}),
    ...(asNumber(o.maxH) !== undefined ? { maxH: o.maxH as number } : {}),
  };
}

function migrateWidget(raw: unknown): WidgetInstance {
  const o = isPlainObject(raw) ? raw : {};
  const config = isPlainObject(o.config) ? o.config : {};
  return {
    id: asString(o.id) ?? '',
    type: asString(o.type) ?? 'unknown',
    title: asString(o.title) ?? '',
    config,
    layout: migrateLayout(o.layout),
  };
}

function migrateBackground(layout: Record<string, unknown>): ViewBackground | undefined {
  const photos = Array.isArray(layout.backgroundPhotos) ? layout.backgroundPhotos : undefined;
  const background: ViewBackground = {
    ...(asString(layout.backgroundImage) ? { image: layout.backgroundImage as string } : {}),
    ...(layout.backgroundImageSize === 'cover' ||
    layout.backgroundImageSize === 'contain' ||
    layout.backgroundImageSize === 'tile'
      ? { imageSize: layout.backgroundImageSize }
      : {}),
    ...(asNumber(layout.backgroundOverlayOpacity) !== undefined
      ? { overlayOpacity: layout.backgroundOverlayOpacity as number }
      : {}),
    ...(photos ? { photos } : {}),
    ...(asNumber(layout.backgroundInterval) !== undefined
      ? { intervalSeconds: layout.backgroundInterval as number }
      : {}),
  };
  return Object.keys(background).length > 0 ? background : undefined;
}

function migrateNotes(raw: unknown): StickyNote[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(isPlainObject).map((n) => ({
    id: asString(n.id) ?? '',
    text: asString(n.text) ?? '',
    x: asNumber(n.x) ?? 0,
    y: asNumber(n.y) ?? 0,
    color: asString(n.color) ?? 'yellow',
  }));
}

function migrateView(raw: unknown): View {
  const o = isPlainObject(raw) ? raw : {};
  const widgets = Array.isArray(o.widgets) ? o.widgets.map(migrateWidget) : [];
  const existingBackground = isPlainObject(o.background) ? o.background : undefined;
  const background = existingBackground
    ? {
        ...(asString(existingBackground.image) ? { image: existingBackground.image as string } : {}),
        ...(existingBackground.imageSize === 'cover' ||
        existingBackground.imageSize === 'contain' ||
        existingBackground.imageSize === 'tile'
          ? { imageSize: existingBackground.imageSize }
          : {}),
        ...(asNumber(existingBackground.overlayOpacity) !== undefined
          ? { overlayOpacity: existingBackground.overlayOpacity as number }
          : {}),
        ...(Array.isArray(existingBackground.photos) ? { photos: existingBackground.photos } : {}),
        ...(asNumber(existingBackground.intervalSeconds) !== undefined
          ? { intervalSeconds: existingBackground.intervalSeconds as number }
          : {}),
      }
    : migrateBackground(o);
  const notes = migrateNotes(o.notes);
  return {
    id: asString(o.id) ?? '',
    name: asString(o.name) ?? 'View',
    ...(asString(o.icon) ? { icon: o.icon as string } : {}),
    ...(asBoolean(o.hidden) !== undefined ? { hidden: o.hidden as boolean } : {}),
    columns: asNumber(o.columns) ?? 12,
    rowHeight: asNumber(o.rowHeight) ?? 80,
    widgets,
    ...(background && Object.keys(background).length > 0 ? { background } : {}),
    ...(notes ? { notes } : {}),
  };
}

function migrateAlarms(raw: unknown): AlarmDefinition[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(isPlainObject).map((a) => ({
    id: asString(a.id) ?? '',
    label: asString(a.label) ?? '',
    enabled: asBoolean(a.enabled) ?? true,
    time: asString(a.time) ?? '00:00',
    days: Array.isArray(a.days) ? a.days.filter((d): d is number => typeof d === 'number') : [],
    toneId:
      a.toneId === 'chime' || a.toneId === 'bell' || a.toneId === 'radar' ? a.toneId : 'chime',
  }));
}

export function migrateDisplayDocument(raw: unknown): DisplayDocument {
  if (!isPlainObject(raw)) {
    throw new TypeError('Display document must be a plain object');
  }

  if (raw.schemaVersion === 1 && Array.isArray(raw.views)) {
    const rotation = isPlainObject(raw.rotation) ? raw.rotation : {};
    const settings = isPlainObject(raw.settings) ? raw.settings : {};
    const v1ColorMode: ColorMode | undefined =
      raw.colorMode === 'light' || raw.colorMode === 'dark' ? raw.colorMode : undefined;
    const v1Holiday = asString(settings.holidayPreviewId) as HolidayId | undefined;
    const v1Alarms = migrateAlarms(raw.alarms);
    return {
      schemaVersion: 1,
      name: asString(raw.name) ?? DEFAULT_NAME,
      views: raw.views.map(migrateView),
      activeViewId: asString(raw.activeViewId) ?? null,
      rotation: {
        enabled: asBoolean(rotation.enabled) ?? false,
        intervalMs: asNumber(rotation.intervalMs) ?? DEFAULT_ROTATION_MS,
      },
      themes: Array.isArray(raw.themes) ? raw.themes : [],
      activeThemeId: asString(raw.activeThemeId) ?? null,
      ...(v1ColorMode ? { colorMode: v1ColorMode } : {}),
      settings: {
        ...(asBoolean(settings.stickyNotesEnabled) !== undefined
          ? { stickyNotesEnabled: settings.stickyNotesEnabled as boolean }
          : {}),
        ...(asBoolean(settings.voiceEnabled) !== undefined
          ? { voiceEnabled: settings.voiceEnabled as boolean }
          : {}),
        ...(asBoolean(settings.holidayEffectsEnabled) !== undefined
          ? { holidayEffectsEnabled: settings.holidayEffectsEnabled as boolean }
          : {}),
        ...(v1Holiday ? { holidayPreviewId: v1Holiday } : {}),
      },
      ...(v1Alarms ? { alarms: v1Alarms } : {}),
    };
  }

  const layouts = Array.isArray(raw.layouts) ? raw.layouts : [];
  const holidayPreviewId = asString(raw.holidayPreviewId) as HolidayId | undefined;
  const colorMode: ColorMode | undefined =
    raw.colorMode === 'light' || raw.colorMode === 'dark' ? raw.colorMode : undefined;

  const settings: DisplayDocument['settings'] = {
    ...(asBoolean(raw.stickyNotesEnabled) !== undefined
      ? { stickyNotesEnabled: raw.stickyNotesEnabled as boolean }
      : {}),
    ...(asBoolean(raw.voiceEnabled) !== undefined ? { voiceEnabled: raw.voiceEnabled as boolean } : {}),
    ...(asBoolean(raw.holidayEffectsEnabled) !== undefined
      ? { holidayEffectsEnabled: raw.holidayEffectsEnabled as boolean }
      : {}),
    ...(holidayPreviewId ? { holidayPreviewId } : {}),
  };

  const alarms = migrateAlarms(raw.alarms);

  return {
    schemaVersion: 1,
    name: asString(raw.name) ?? DEFAULT_NAME,
    views: layouts.map(migrateView),
    activeViewId: asString(raw.activeLayoutId) ?? asString(raw.activeViewId) ?? null,
    rotation: {
      enabled: asBoolean(raw.rotationEnabled) ?? false,
      intervalMs: asNumber(raw.rotationIntervalMs) ?? DEFAULT_ROTATION_MS,
    },
    themes: Array.isArray(raw.themes) ? raw.themes : [],
    activeThemeId: asString(raw.activeThemeId) ?? null,
    ...(colorMode ? { colorMode } : {}),
    settings,
    ...(alarms ? { alarms } : {}),
  };
}
```

Update `packages/schema/src/index.ts` to:

```ts
export const SCHEMA_PACKAGE_NAME = '@homeslate/schema';
export type {
  AlarmDefinition,
  AlarmToneId,
  ColorMode,
  DisplayDocument,
  HolidayId,
  StickyNote,
  View,
  ViewBackground,
  WidgetInstance,
  WidgetLayout,
} from './types';
export { migrateDisplayDocument } from './migrate';
```

The first test’s `themes: [{ ..., tokens: {} }]` is intentionally invalid theme data. The migrator must pass `themes` through unchanged. Theme correctness is Task 4.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/schema/src/migrate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/types.ts packages/schema/src/migrate.ts packages/schema/src/migrate.test.ts packages/schema/src/index.ts
git commit -m "feat: migrate v0 display configs to DisplayDocument v1"
```

---

### Task 3: validateDisplayDocument And Config Schema Registry

**Files:**
- Create: `packages/schema/src/validate.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/src/validate.test.ts`

**Interfaces:**
- Consumes: `DisplayDocument`, `migrateDisplayDocument`
- Produces:
  - `export type DisplayValidationError = { path: string; message: string }`
  - `export type DisplayValidationResult = { ok: true; document: DisplayDocument } | { ok: false; errors: DisplayValidationError[] }`
  - `export function validateDisplayDocument(raw: unknown): DisplayValidationResult`
  - `export function registerWidgetConfigSchema(type: string, schema: z.ZodType): void`
  - `export function clearWidgetConfigSchemas(): void` (tests only)

`validateDisplayDocument` MUST run `migrateDisplayDocument` first so callers can pass v0 or v1.

- [ ] **Step 1: Write the failing tests**

Create `packages/schema/src/validate.test.ts`:

```ts
import { describe, expect, it, afterEach } from 'vitest';
import { z } from 'zod';
import {
  clearWidgetConfigSchemas,
  registerWidgetConfigSchema,
  validateDisplayDocument,
} from './validate';

afterEach(() => {
  clearWidgetConfigSchemas();
});

const validWidget = {
  id: 'w1',
  type: 'mystery-widget',
  title: 'Mystery',
  config: { anything: true },
  layout: { x: 0, y: 0, w: 2, h: 2 },
};

const validDoc = {
  schemaVersion: 1 as const,
  name: 'Kitchen',
  views: [
    {
      id: 'v1',
      name: 'Main',
      columns: 12,
      rowHeight: 80,
      widgets: [validWidget],
    },
  ],
  activeViewId: 'v1',
  rotation: { enabled: false, intervalMs: 30000 },
  themes: [],
  activeThemeId: null,
  settings: {},
};

describe('validateDisplayDocument', () => {
  it('accepts an unknown widget type with a valid instance shape', () => {
    const result = validateDisplayDocument(validDoc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.views[0].widgets[0].config).toEqual({ anything: true });
    }
  });

  it('rejects a widget missing layout.x', () => {
    const result = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [{ ...validWidget, layout: { y: 0, w: 2, h: 2 } }],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /layout/i.test(e.path) || /layout/i.test(e.message))).toBe(
        true
      );
    }
  });

  it('rejects a non-object', () => {
    const result = validateDisplayDocument(null);
    expect(result.ok).toBe(false);
  });

  it('applies a registered config schema to that type only', () => {
    registerWidgetConfigSchema(
      'clock',
      z.object({
        showSeconds: z.boolean(),
        timezone: z.string(),
      })
    );
    const invalid = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [
            { ...validWidget, type: 'clock', config: { showSeconds: 'yes' } },
            validWidget,
          ],
        },
      ],
    });
    expect(invalid.ok).toBe(false);

    const valid = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [
            {
              ...validWidget,
              type: 'clock',
              config: { showSeconds: true, timezone: 'local' },
            },
            validWidget,
          ],
        },
      ],
    });
    expect(valid.ok).toBe(true);
  });

  it('migrates v0 then validates', () => {
    const result = validateDisplayDocument({
      layouts: [
        {
          id: 'v1',
          name: 'Main',
          columns: 12,
          rowHeight: 80,
          widgets: [validWidget],
        },
      ],
      activeLayoutId: 'v1',
      rotationEnabled: false,
      rotationIntervalMs: 30000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.schemaVersion).toBe(1);
      expect(result.document.views[0].id).toBe('v1');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/schema/src/validate.test.ts`

Expected: FAIL — `./validate` not found.

- [ ] **Step 3: Implement validation**

Create `packages/schema/src/validate.ts`:

```ts
import { z } from 'zod';
import { migrateDisplayDocument } from './migrate';
import type { DisplayDocument } from './types';

export type DisplayValidationError = { path: string; message: string };

export type DisplayValidationResult =
  | { ok: true; document: DisplayDocument }
  | { ok: false; errors: DisplayValidationError[] };

const widgetConfigSchemas = new Map<string, z.ZodType>();

export function registerWidgetConfigSchema(type: string, schema: z.ZodType): void {
  widgetConfigSchemas.set(type, schema);
}

export function clearWidgetConfigSchemas(): void {
  widgetConfigSchemas.clear();
}

const holidayIdSchema = z.enum([
  'new-years-day',
  'valentines-day',
  'st-patricks-day',
  'independence-day',
  'halloween',
  'thanksgiving',
  'christmas',
  'new-years-eve',
]);

const widgetLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  minW: z.number().optional(),
  minH: z.number().optional(),
  maxW: z.number().optional(),
  maxH: z.number().optional(),
});

const widgetInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string(),
  config: z.record(z.string(), z.unknown()),
  layout: widgetLayoutSchema,
});

const viewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional(),
  hidden: z.boolean().optional(),
  columns: z.number(),
  rowHeight: z.number(),
  widgets: z.array(widgetInstanceSchema),
  background: z
    .object({
      image: z.string().optional(),
      imageSize: z.enum(['cover', 'contain', 'tile']).optional(),
      overlayOpacity: z.number().optional(),
      photos: z.array(z.unknown()).optional(),
      intervalSeconds: z.number().optional(),
    })
    .optional(),
  notes: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string(),
        x: z.number(),
        y: z.number(),
        color: z.string().min(1),
      })
    )
    .optional(),
});

const displayDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1),
  views: z.array(viewSchema),
  activeViewId: z.string().nullable(),
  rotation: z.object({
    enabled: z.boolean(),
    intervalMs: z.number().int().positive(),
  }),
  themes: z.array(z.unknown()),
  activeThemeId: z.string().nullable(),
  colorMode: z.enum(['light', 'dark']).optional(),
  settings: z.object({
    stickyNotesEnabled: z.boolean().optional(),
    voiceEnabled: z.boolean().optional(),
    holidayEffectsEnabled: z.boolean().optional(),
    holidayPreviewId: holidayIdSchema.optional(),
  }),
  alarms: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string(),
        enabled: z.boolean(),
        time: z.string(),
        days: z.array(z.number().int().min(0).max(6)),
        toneId: z.enum(['chime', 'bell', 'radar']),
      })
    )
    .optional(),
});

function flattenZod(error: z.ZodError): DisplayValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '$',
    message: issue.message,
  }));
}

export function validateDisplayDocument(raw: unknown): DisplayValidationResult {
  let migrated: DisplayDocument;
  try {
    migrated = migrateDisplayDocument(raw);
  } catch (err) {
    return {
      ok: false,
      errors: [{ path: '$', message: err instanceof Error ? err.message : 'Invalid document' }],
    };
  }

  const parsed = displayDocumentSchema.safeParse(migrated);
  if (!parsed.success) {
    return { ok: false, errors: flattenZod(parsed.error) };
  }

  const extra: DisplayValidationError[] = [];
  parsed.data.views.forEach((view, viewIndex) => {
    view.widgets.forEach((widget, widgetIndex) => {
      const configSchema = widgetConfigSchemas.get(widget.type);
      if (!configSchema) return;
      const configParsed = configSchema.safeParse(widget.config);
      if (!configParsed.success) {
        extra.push(
          ...flattenZod(configParsed.error).map((e) => ({
            path: `views.${viewIndex}.widgets.${widgetIndex}.config.${e.path}`.replace(/\.$/, ''),
            message: e.message,
          }))
        );
      }
    });
  });

  if (extra.length > 0) {
    return { ok: false, errors: extra };
  }

  return { ok: true, document: parsed.data as DisplayDocument };
}
```

Export the new symbols from `packages/schema/src/index.ts`:

```ts
export const SCHEMA_PACKAGE_NAME = '@homeslate/schema';
export type {
  AlarmDefinition,
  AlarmToneId,
  ColorMode,
  DisplayDocument,
  HolidayId,
  StickyNote,
  View,
  ViewBackground,
  WidgetInstance,
  WidgetLayout,
} from './types';
export { migrateDisplayDocument } from './migrate';
export {
  validateDisplayDocument,
  registerWidgetConfigSchema,
  clearWidgetConfigSchemas,
} from './validate';
export type { DisplayValidationError, DisplayValidationResult } from './validate';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/schema/src/validate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/validate.ts packages/schema/src/validate.test.ts packages/schema/src/index.ts
git commit -m "feat: validate DisplayDocument and allow unknown widget types"
```

---

### Task 4: Move Theme Validation Into Schema Package

**Files:**
- Create: `packages/schema/src/themeDocumentValidation.ts` (move)
- Create: `packages/schema/src/themeDocumentValidation.test.ts` (move)
- Create: `packages/schema/schemas/theme-document.schema.json` (move)
- Modify: `src/themes/themeDocumentValidation.ts` (shim)
- Modify: `packages/schema/src/index.ts`
- Modify: `packages/schema/src/validate.ts` (validate each theme with `validateThemeDocument`)
- Test: existing theme tests at new path + a new case in `validate.test.ts`

**Interfaces:**
- Consumes: `validateDisplayDocument`
- Produces: `validateThemeDocument`, `ThemeDocument`, `ThemeValidationResult` exported from `@homeslate/schema`; `src/themes/themeDocumentValidation.ts` re-exports so existing app imports keep working

- [ ] **Step 1: Move files**

```bash
mkdir -p packages/schema/schemas
git mv src/themes/themeDocumentValidation.ts packages/schema/src/themeDocumentValidation.ts
git mv src/themes/themeDocumentValidation.test.ts packages/schema/src/themeDocumentValidation.test.ts
git mv schemas/theme-document.schema.json packages/schema/schemas/theme-document.schema.json
```

If `git mv` fails because files are untracked, use `mv` then `git add`.

Write `src/themes/themeDocumentValidation.ts` as:

```ts
export {
  validateThemeDocument,
  isThemeDocumentCandidate,
  type ThemeDocument,
  type ThemeValidationIssue,
  type ThemeValidationResult,
} from '@homeslate/schema';
```

Export those same names from `packages/schema/src/index.ts`.

In `packages/schema/src/themeDocumentValidation.test.ts`, keep the existing import path `from "./themeDocumentValidation"` (still valid after the move).

- [ ] **Step 2: Run moved theme tests (expect pass if the move is clean)**

Run: `npx vitest run packages/schema/src/themeDocumentValidation.test.ts src/themes/defaults.test.ts src/themes/resolver.test.ts`

Expected: PASS. If imports break, fix only import specifiers.

- [ ] **Step 3: Reject invalid themes on the display document**

Add to `packages/schema/src/validate.test.ts`:

```ts
  it('rejects an invalid theme document in themes[]', () => {
    const result = validateDisplayDocument({
      ...validDoc,
      themes: [{ id: 'bad' }],
    });
    expect(result.ok).toBe(false);
  });
```

Run: `npx vitest run packages/schema/src/validate.test.ts`

Expected: FAIL (themes are still `z.array(z.unknown())` with no theme validation).

In `validate.ts`, import `validateThemeDocument` from `./themeDocumentValidation`. After the Zod parse succeeds, loop `parsed.data.themes` and if an entry fails `validateThemeDocument`, push errors with path `themes.${index}.${issue.path}`.

Also: if `activeThemeId` is a string, it must equal one of the theme `id`s (same rule as `netlify/functions/config.ts`). Add this test to `validate.test.ts`:

```ts
  it('rejects activeThemeId that is not in themes', () => {
    const result = validateDisplayDocument({
      ...validDoc,
      themes: [],
      activeThemeId: 'missing',
    });
    expect(result.ok).toBe(false);
  });
```

`activeThemeId: null` remains valid.

- [ ] **Step 4: Run tests**

Run: `npx vitest run packages/schema/src/validate.test.ts packages/schema/src/themeDocumentValidation.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/schema src/themes/themeDocumentValidation.ts schemas
git commit -m "feat: move theme document validation into @homeslate/schema"
```

Include the deletion of `schemas/theme-document.schema.json` at the old path if `git mv` already staged it.

---

### Task 5: Host Bridge — Legacy Config Shape

**Files:**
- Create: `src/displayDocumentBridge.ts`
- Test: `src/displayDocumentBridge.test.ts`

**Interfaces:**
- Consumes: `migrateDisplayDocument`, `validateDisplayDocument`, `DisplayDocument`
- Produces:
  - `export function toLegacyConfig(document: DisplayDocument): Record<string, unknown>`
  - `export function readStoredConfig(raw: unknown): { document: DisplayDocument; legacy: Record<string, unknown> }`
  - `export function writeStoredConfig(raw: unknown): DisplayValidationResult`

`toLegacyConfig` must restore the keys the current React app and kiosk expect: `layouts`, `activeLayoutId`, `rotationEnabled`, `rotationIntervalMs`, top-level settings, flattened background fields. Query param `layoutId` on todos/notes still means view id.

- [ ] **Step 1: Write the failing tests**

Create `src/displayDocumentBridge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { migrateDisplayDocument } from '@homeslate/schema';
import { readStoredConfig, toLegacyConfig, writeStoredConfig } from './displayDocumentBridge';

const v0 = {
  layouts: [
    {
      id: 'view-1',
      name: 'Morning',
      columns: 12,
      rowHeight: 80,
      widgets: [
        {
          id: 'w1',
          type: 'clock',
          title: 'Clock',
          config: {},
          layout: { x: 0, y: 0, w: 2, h: 2 },
        },
      ],
      backgroundImage: 'https://example.com/bg.jpg',
      backgroundImageSize: 'cover',
      backgroundOverlayOpacity: 0.2,
      backgroundPhotos: [{ type: 'stored', key: 'k', filename: 'f.png' }],
      backgroundInterval: 9,
      notes: [{ id: 'n1', text: 'hi', x: 1, y: 2, color: 'pink' }],
    },
  ],
  activeLayoutId: 'view-1',
  rotationEnabled: true,
  rotationIntervalMs: 12000,
  stickyNotesEnabled: true,
  voiceEnabled: true,
  colorMode: 'light',
};

describe('toLegacyConfig', () => {
  it('round-trips v0 through v1 back to layouts for the current UI', () => {
    const document = migrateDisplayDocument(v0);
    const legacy = toLegacyConfig(document);
    expect(legacy.layouts).toHaveLength(1);
    const layout = (legacy.layouts as Array<Record<string, unknown>>)[0];
    expect(layout.id).toBe('view-1');
    expect(layout.backgroundImage).toBe('https://example.com/bg.jpg');
    expect(layout.backgroundImageSize).toBe('cover');
    expect(layout.backgroundOverlayOpacity).toBe(0.2);
    expect(layout.backgroundPhotos).toEqual([{ type: 'stored', key: 'k', filename: 'f.png' }]);
    expect(layout.backgroundInterval).toBe(9);
    expect(layout.notes).toEqual(v0.layouts[0].notes);
    expect(legacy.activeLayoutId).toBe('view-1');
    expect(legacy.rotationEnabled).toBe(true);
    expect(legacy.rotationIntervalMs).toBe(12000);
    expect(legacy.stickyNotesEnabled).toBe(true);
    expect(legacy.voiceEnabled).toBe(true);
    expect(legacy.colorMode).toBe('light');
    expect(legacy.schemaVersion).toBeUndefined();
    expect(legacy.views).toBeUndefined();
  });
});

describe('writeStoredConfig / readStoredConfig', () => {
  it('accepts v0 PUT bodies and returns a v1 document', () => {
    const written = writeStoredConfig(v0);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.document.schemaVersion).toBe(1);
    expect(written.document.views[0].id).toBe('view-1');
  });

  it('rejects invalid PUT bodies', () => {
    const written = writeStoredConfig({
      layouts: [
        {
          id: 'view-1',
          name: 'Morning',
          columns: 12,
          rowHeight: 80,
          widgets: [{ id: 'w1', type: 'clock', title: 'Clock', config: {} }],
        },
      ],
      activeLayoutId: 'view-1',
      rotationEnabled: true,
      rotationIntervalMs: 12000,
    });
    expect(written.ok).toBe(false);
  });

  it('readStoredConfig always yields legacy layouts even if the row is already v1', () => {
    const written = writeStoredConfig(v0);
    if (!written.ok) throw new Error('expected ok');
    const read = readStoredConfig(written.document);
    expect((read.legacy.layouts as unknown[]).length).toBe(1);
    expect(read.document.schemaVersion).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/displayDocumentBridge.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the bridge**

Create `src/displayDocumentBridge.ts`:

```ts
import {
  validateDisplayDocument,
  migrateDisplayDocument,
  type DisplayDocument,
  type DisplayValidationResult,
  type View,
} from '@homeslate/schema';

function viewToLegacyLayout(view: View): Record<string, unknown> {
  const layout: Record<string, unknown> = {
    id: view.id,
    name: view.name,
    widgets: view.widgets,
    columns: view.columns,
    rowHeight: view.rowHeight,
  };
  if (view.icon !== undefined) layout.icon = view.icon;
  if (view.hidden !== undefined) layout.hidden = view.hidden;
  if (view.notes !== undefined) layout.notes = view.notes;
  if (view.background?.image !== undefined) layout.backgroundImage = view.background.image;
  if (view.background?.imageSize !== undefined) layout.backgroundImageSize = view.background.imageSize;
  if (view.background?.overlayOpacity !== undefined) {
    layout.backgroundOverlayOpacity = view.background.overlayOpacity;
  }
  if (view.background?.photos !== undefined) layout.backgroundPhotos = view.background.photos;
  if (view.background?.intervalSeconds !== undefined) {
    layout.backgroundInterval = view.background.intervalSeconds;
  }
  return layout;
}

export function toLegacyConfig(document: DisplayDocument): Record<string, unknown> {
  const legacy: Record<string, unknown> = {
    layouts: document.views.map(viewToLegacyLayout),
    activeLayoutId: document.activeViewId,
    rotationEnabled: document.rotation.enabled,
    rotationIntervalMs: document.rotation.intervalMs,
    themes: document.themes,
    activeThemeId: document.activeThemeId,
  };
  if (document.colorMode !== undefined) legacy.colorMode = document.colorMode;
  if (document.settings.stickyNotesEnabled !== undefined) {
    legacy.stickyNotesEnabled = document.settings.stickyNotesEnabled;
  }
  if (document.settings.voiceEnabled !== undefined) {
    legacy.voiceEnabled = document.settings.voiceEnabled;
  }
  if (document.settings.holidayEffectsEnabled !== undefined) {
    legacy.holidayEffectsEnabled = document.settings.holidayEffectsEnabled;
  }
  if (document.settings.holidayPreviewId !== undefined) {
    legacy.holidayPreviewId = document.settings.holidayPreviewId;
  }
  if (document.alarms !== undefined) legacy.alarms = document.alarms;
  return legacy;
}

export function writeStoredConfig(raw: unknown): DisplayValidationResult {
  return validateDisplayDocument(raw);
}

export function readStoredConfig(raw: unknown): {
  document: DisplayDocument;
  legacy: Record<string, unknown>;
} {
  let document: DisplayDocument;
  try {
    document = migrateDisplayDocument(raw);
  } catch {
    document = migrateDisplayDocument({});
  }
  const validated = validateDisplayDocument(document);
  if (validated.ok) {
    return { document: validated.document, legacy: toLegacyConfig(validated.document) };
  }
  return { document, legacy: toLegacyConfig(document) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/displayDocumentBridge.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/displayDocumentBridge.ts src/displayDocumentBridge.test.ts
git commit -m "feat: bridge DisplayDocument v1 to legacy layouts config"
```

---

### Task 6: Persist v1 From Netlify Functions

**Files:**
- Modify: `netlify/functions/config.ts`
- Modify: `netlify/functions/display.ts`
- Modify: `netlify/functions/displays.ts`
- Modify: `netlify/functions/todos.ts`
- Modify: `netlify/functions/notes.ts`

**Interfaces:**
- Consumes: `writeStoredConfig`, `readStoredConfig`
- Produces: jsonb `display_configs.config` is a v1 `DisplayDocument` after any successful write; GET/list still return legacy `layouts` to the current client

Keep `stripLegacyThemeFields` in `display.ts` / `displays.ts`. Apply it **before** `readStoredConfig`.

- [ ] **Step 1: Update config PUT**

In `netlify/functions/config.ts`:

1. Import `writeStoredConfig` from `../../src/displayDocumentBridge`.
2. After `JSON.parse`, **delete** `ConfigBodySchema` / `safeParse` (schema package replaces it). Call:

```ts
const written = writeStoredConfig(rawBody);
if (!written.ok) {
  return errorResponse(400, 'Invalid config payload', AUTH_JSON_HEADERS, {
    details: written.errors,
  });
}
const config = written.document;
```

3. Keep the owner/collaborator access checks unchanged.
4. Insert/update `displayConfigs` with `config` set to `written.document` (v1), not the raw body.
5. Remove the duplicate `validateThemeDocument` block and `activeThemeId` check — `validateDisplayDocument` now owns those.

Theme validation used to run on the raw PUT body before migrate. After this change, themes are validated on the migrated document. That is correct.

- [ ] **Step 2: Update display GET**

In `netlify/functions/display.ts`, replace the success body:

```ts
import { readStoredConfig } from '../../src/displayDocumentBridge';
```

```ts
const stripped = stripLegacyThemeFields(config);
const { legacy } = readStoredConfig(stripped);
return {
  statusCode: 200,
  headers: CORS,
  body: JSON.stringify({ config: legacy, updated_at: updatedAt }),
};
```

Do not 500 if validation fails; `readStoredConfig` already falls back to a migrated document.

- [ ] **Step 3: Update displays GET list**

In `netlify/functions/displays.ts`, wherever a row’s `config` is returned to the client (the `stripLegacyThemeFields(r.config)` mapping), use:

```ts
import { readStoredConfig } from '../../src/displayDocumentBridge';

config: r.config == null ? null : readStoredConfig(stripLegacyThemeFields(r.config)).legacy,
```

Keep `is_owner`, ids, names, passcode flags unchanged.

- [ ] **Step 4: Update todos PATCH**

Replace the `layouts` mutation in `netlify/functions/todos.ts` with:

```ts
import { readStoredConfig, writeStoredConfig } from '../../src/displayDocumentBridge';

const { document } = readStoredConfig(config);
const next: typeof document = {
  ...document,
  views: document.views.map((view) => {
    if (view.id !== layoutId) return view;
    return {
      ...view,
      widgets: view.widgets.map((w) =>
        w.id === widgetId ? { ...w, config: { ...w.config, items } } : w
      ),
    };
  }),
};
const written = writeStoredConfig(next);
if (!written.ok) {
  return errorResponse(400, 'Invalid todos payload', PUBLIC_JSON_HEADERS, {
    details: written.errors,
  });
}
await db
  .update(displayConfigs)
  .set({ config: written.document, updatedAt: new Date().toISOString() })
  .where(eq(displayConfigs.displayId, configDisplayId));
```

Keep query params named `layoutId` (current kiosk/editor).

- [ ] **Step 5: Update notes PATCH**

Same pattern as todos in `netlify/functions/notes.ts`: `readStoredConfig` → map `views` where `view.id === layoutId` → `{ ...view, notes }` → `writeStoredConfig` → persist `written.document`.

- [ ] **Step 6: Run unit tests**

Run: `npx vitest run packages/schema src/displayDocumentBridge.test.ts src/themes`

Expected: PASS

There is no existing automated test for Netlify handlers. Do not add a Netlify harness in this task.

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/config.ts netlify/functions/display.ts netlify/functions/displays.ts netlify/functions/todos.ts netlify/functions/notes.ts
git commit -m "feat: persist DisplayDocument v1 from config, todos, and notes APIs"
```

---

### Task 7: Full Test Suite And Typecheck

**Files:**
- Modify only if `tsc` or tests report errors (likely `src/types/theme.ts` still compiles via the shim)

**Interfaces:**
- Consumes: all previous tasks
- Produces: green `vitest run` and `tsc -b`

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:run`

Expected: PASS. If `themeDocumentValidation` shim causes a circular import, export theme symbols from `packages/schema/src/index.ts` using a type-only re-export and keep the shim.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`

Expected: exit 0. Netlify functions import `@homeslate/schema` / the bridge; if `tsconfig.node.json` or functions are not in `tsc -b`, still typecheck the app. If functions fail because they are not in a tsconfig, do not add a new tsconfig this plan unless `tsc -b` already included them.

- [ ] **Step 3: Commit only if Step 1–2 required code fixes**

```bash
git add -u
git commit -m "fix: keep app compiling after schema package extraction"
```

If nothing changed, skip the commit.

---

## Spec coverage (Phase 1)

| Spec requirement | Task |
|---|---|
| `@homeslate/schema` types + JSON-ish Zod validation | 2, 3 |
| `schemaVersion` + `v0 → v1` (`layouts` → `views`) | 2 |
| Unknown widget types round-trip | 3 |
| `registerWidgetConfigSchema` for later widget package | 3 |
| Theme schema lives in schema package | 4 |
| Hosts migrate on read, writes persist v1 | 5, 6 |
| PUT rejects invalid documents | 5, 6 |
| GET does not blank the kiosk on messy rows | 5, 6 |
| Stored background photos preserved | 2, 5 |
| Current Vite app keeps running (`layouts` in UI) | 5, 6 |
| No billing/quota in public package | all |
| `@homeslate/google`, widgets, editor, display, adapters, reference, entitlements | **not this plan** (Phases 2–6) |

Out of scope (same as spec): Stripe numbers, marketplace, replacing Netlify, AGPL/BSL, calendar UX changes.
