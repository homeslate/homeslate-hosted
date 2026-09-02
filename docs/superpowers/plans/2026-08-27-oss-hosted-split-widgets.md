# OSS Hosted Split — Phase 3: Widgets Package Implementation Plan

> **Status: complete** (merged to `main` at `e222c35`, 2026-09-01). Tasks 1–7 shipped: `@homeslate/widgets`, `registerWidget()`, `GoogleRuntime`, built-in `configSchema`s, `UnknownWidget`.

> **For agentic workers:** This plan is done. Do not re-execute. Phase 4 is next. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add `@homeslate/widgets` with a formal `registerWidget()` API, move built-in widgets into that package, attach Zod `configSchema`s next to each type, and stop widgets from importing hosted auth.

**Architecture:** The package owns registry types, built-in components/settings, widget data hooks/services, and a `GoogleRuntime` React context. The current Vite app becomes a host: it provides `GoogleRuntime` from `AuthContext` + `DisplayContext`, imports the package, and keeps app shell, routing, stores, and alarm *runtime* (dialog/tones/queue). Built-in config schemas also load through a React-free `@homeslate/widgets/schemas` entry so Netlify PUT validation can reject invalid built-in configs without importing React.

**Tech Stack:** TypeScript 5.9, React 19, Zod 4.3.6, Vitest 3, npm workspaces, Vite 7, Mantine 8, existing widget CSS modules.

**Spec:** `docs/superpowers/specs/2026-08-27-oss-hosted-split-design.md`

## Global Constraints

- Formalize `registerWidget()`. Built-ins register themselves inside `@homeslate/widgets`. Hosts call `registerWidget` for custom types before mounting editor or display.
- `WidgetRegistryEntry` includes optional `configSchema?: ZodType`. `registerWidget` calls `registerWidgetConfigSchema(type, schema)` from `@homeslate/schema` when `configSchema` is set.
- Built-in `type`s have a strict *type* schema (wrong types fail) but every field is **optional**, so historical documents with missing keys still validate. Do not use `.strict()`. Extra keys pass through.
- Unknown `type`s remain valid documents. Editor/display render an `UnknownWidget` placeholder unless a matching `registerWidget` exists.
- A widget that needs Google reads `GoogleRuntime` from context (provided by the host). Widgets must not import Netlify, Neon, `AuthContext`, or `googleAuth.ts`.
- `GoogleRuntime` default (no provider) is signed-out / no `displayId`. Widgets show existing empty states; they must not throw.
- Do not greenfield-rewrite widget JSX. Carve by `git mv` + import retarget. Do not change Google Calendar widget UX except swapping `useAuth` / `useDisplayId` for `useGoogleRuntime`.
- GIS popup OAuth (`AuthContext`) stays hosted. Browser Calendar CRUD + Photos picker *files* move with the widgets that call them (Phase 2 left them in `src/services` until this extraction).
- Alarm *runtime* (`AlarmRuntime`, dialog, tones, `schedule.ts`, voice) stays in `src/alarms`. `AlarmsContext` + `AlarmListEditor` + `src/timers/` move because the widgets consume them.
- `GooglePhotosWidget` is not in the registry today; move the file, do **not** register it.
- No billing, quota, or Homeslate-account code in `@homeslate/widgets`.
- MIT public packages; this package is public-core.

## Plan series (this file is Phase 3 only)

Phase 1 (`docs/superpowers/plans/2026-08-27-oss-hosted-split-schema.md`), Phase 2 (`docs/superpowers/plans/2026-08-27-oss-hosted-split-google.md`), and this file are done.

| Phase | Plan file | Delivers |
|---|---|---|
| 1 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-schema.md` | `@homeslate/schema`, v0→v1, live API persists v1 |
| 2 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-google.md` | `@homeslate/google`, thin Netlify wrappers |
| 3 | this file (done) | `@homeslate/widgets` + `registerWidget()` + built-in `configSchema`s |
| 4 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-editor-display.md` | `@homeslate/editor` + `@homeslate/display` |
| 5 | not written yet | `@homeslate/adapters` + `apps/reference` |
| 6 | not written yet | hosted entitlements + private repo split |

## Why GoogleRuntime exists in this plan

Spec: host wraps editor/display in a `GoogleRuntime` React context (access token for the editor session, kiosk fetch base URL for the display). Today Google widgets import `useAuth` and `useDisplayId` directly. That cannot survive the package carve.

`GoogleRuntime` is the only Google/kiosk seam widgets may read. Hosted identity (`AuthProvider`, GIS, `/api/me`) stays in `src/contexts/AuthContext.tsx`.

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/widgets/package.json` | `@homeslate/widgets` manifest; exports `.` and `./schemas` |
| `packages/widgets/src/index.ts` | Public React exports; side-effect register built-ins |
| `packages/widgets/src/types.ts` | `WidgetConfig`, `WidgetDefinition`, `WidgetProps`, `WidgetRegistryEntry` |
| `packages/widgets/src/registry.ts` | `registerWidget`, `getWidgetByType`, `getWidgetTypes`, `clearWidgetRegistry` |
| `packages/widgets/src/googleRuntime.tsx` | `GoogleRuntime` type, provider, `useGoogleRuntime` |
| `packages/widgets/src/configSchemas.ts` | Zod schemas + `registerBuiltInWidgetConfigSchemas()` (no React) |
| `packages/widgets/src/schemas.ts` | `./schemas` entry: register schemas only |
| `packages/widgets/src/UnknownWidget.tsx` | Placeholder for unknown `type` |
| `packages/widgets/src/builtins.ts` | Registers the 15 built-ins (moved registry body) |
| `packages/widgets/src/widgets/*` | Moved widget components + CSS + widget-local helpers |
| `packages/widgets/src/hooks/*` | Moved widget data hooks + polling |
| `packages/widgets/src/services/*` | Moved widget data services (iCal, weather, news, stocks, sports, browser Google) |
| `packages/widgets/src/chrome/*` | `WidgetDataStatus`, `GoogleCalendarEmptyState` |
| `packages/widgets/src/alarms/*` | `AlarmsContext`, `AlarmListEditor` |
| `packages/widgets/src/timers/*` | Moved `src/timers/` |
| `src/host/HostGoogleRuntime.tsx` | Host adapter: AuthContext + DisplayContext → `GoogleRuntimeProvider` |
| `src/widgets/registry.ts` | Re-export shim from `@homeslate/widgets` |
| `src/types/widget.ts` | Host `DashboardLayout`; re-export registry types from the package |
| Modify: `src/displayDocumentBridge.ts` | Import `@homeslate/widgets/schemas` so PUT validates built-in configs |
| Modify: `tsconfig.app.json`, `vite.config.ts`, `vitest.config.ts` | Resolve `@homeslate/widgets` |

Keep unchanged this plan: `src/contexts/AuthContext.tsx`, `src/contexts/DisplayContext.tsx`, `src/alarms/AlarmRuntime.tsx`, `src/alarms/tones.ts`, `src/alarms/schedule.ts`, `netlify/functions/_shared/googleAuth.ts`, `src/services/displayCalendarAuth.ts`, `src/store/dashboardStore.ts`, editor/display shells (`WidgetWrapper` only swaps unknown-type UI + import path).

---

### Task 1: Workspace And Widgets Package Entry

**Files:**
- Modify: `tsconfig.app.json`
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`
- Create: `packages/widgets/package.json`
- Create: `packages/widgets/src/index.ts`
- Test: `packages/widgets/src/index.test.ts`

**Interfaces:**
- Consumes: existing `workspaces: ["packages/*"]` from Phase 1
- Produces: package `@homeslate/widgets` importable as `export const WIDGETS_PACKAGE_NAME = '@homeslate/widgets'`

- [x] **Step 1: Write the failing test**

Create `packages/widgets/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { WIDGETS_PACKAGE_NAME } from '@homeslate/widgets';

describe('@homeslate/widgets', () => {
  it('is importable by package name', () => {
    expect(WIDGETS_PACKAGE_NAME).toBe('@homeslate/widgets');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/widgets/src/index.test.ts`

Expected: FAIL — cannot resolve `@homeslate/widgets` (or file not in vitest include).

- [x] **Step 3: Create the package and wire resolution**

`packages/widgets/package.json`:

```json
{
  "name": "@homeslate/widgets",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schemas": "./src/schemas.ts"
  },
  "dependencies": {
    "@homeslate/schema": "*"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Do **not** create `src/schemas.ts` yet (Task 6). `exports["./schemas"]` may point at a file that does not exist until Task 6; that is OK as long as nothing imports it.

`packages/widgets/src/index.ts`:

```ts
export const WIDGETS_PACKAGE_NAME = '@homeslate/widgets';
```

Add the same alias pattern used for schema/google:

`tsconfig.app.json` `paths`:

```json
"@homeslate/widgets": ["packages/widgets/src/index.ts"],
"@homeslate/widgets/schemas": ["packages/widgets/src/schemas.ts"]
```

Add `"packages/widgets/src"` to `include`.

`vite.config.ts` and `vitest.config.ts` aliases:

```ts
"@homeslate/widgets": fileURLToPath(
  new URL("./packages/widgets/src/index.ts", import.meta.url)
),
"@homeslate/widgets/schemas": fileURLToPath(
  new URL("./packages/widgets/src/schemas.ts", import.meta.url)
),
```

`vitest.config.ts` `include` add `"packages/widgets/src/**/*.test.ts"`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/widgets/src/index.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/widgets/package.json packages/widgets/src/index.ts packages/widgets/src/index.test.ts tsconfig.app.json vite.config.ts vitest.config.ts
git commit -m "feat: add @homeslate/widgets package entry"
```

---

### Task 2: Registry Types And registerWidget()

**Files:**
- Create: `packages/widgets/src/types.ts`
- Create: `packages/widgets/src/registry.ts`
- Create: `packages/widgets/src/registry.test.ts`
- Modify: `packages/widgets/src/index.ts`
- Modify: `packages/schema/src/index.ts` (export `clearWidgetConfigSchemas` for tests)

**Interfaces:**
- Consumes: `registerWidgetConfigSchema` / `clearWidgetConfigSchemas` from `@homeslate/schema`
- Produces:

```ts
export type WidgetConfig = { [key: string]: unknown };

export interface WidgetDefinition<T extends WidgetConfig = WidgetConfig> {
  id: string;
  type: string;
  title: string;
  config: T;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
}

export interface WidgetProps<T extends WidgetConfig = WidgetConfig> {
  widget: WidgetDefinition<T>;
  isEditing: boolean;
  onConfigChange: (config: Partial<T>) => void;
}

export interface WidgetRegistryEntry<T extends WidgetConfig = WidgetConfig> {
  type: string;
  name: string;
  description: string;
  icon: ComponentType<{ size?: number | string }>;
  component: ComponentType<WidgetProps<T>>;
  settingsComponent?: ComponentType<WidgetProps<T>>;
  defaultConfig: T;
  defaultLayout: {
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
  configSchema?: ZodType;
}

export function registerWidget<T extends WidgetConfig>(entry: WidgetRegistryEntry<T>): void;
export function getWidgetTypes(): WidgetRegistryEntry<WidgetConfig>[];
export function getWidgetByType(type: string): WidgetRegistryEntry<WidgetConfig> | undefined;
export function clearWidgetRegistry(): void;
```

Copy field names from `src/types/widget.ts` and add `configSchema`. Do not move `DashboardLayout` / `StickyNote` (host types).

- [x] **Step 1: Write the failing tests**

Create `packages/widgets/src/registry.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  clearWidgetConfigSchemas,
  validateDisplayDocument,
} from '@homeslate/schema';
import {
  clearWidgetRegistry,
  getWidgetByType,
  getWidgetTypes,
  registerWidget,
} from './registry';
import type { WidgetProps } from './types';

afterEach(() => {
  clearWidgetRegistry();
  clearWidgetConfigSchemas();
});

function Dummy({}: WidgetProps) {
  return null;
}

const validDoc = {
  schemaVersion: 1 as const,
  name: 'Kitchen',
  views: [
    {
      id: 'v1',
      name: 'Main',
      columns: 12,
      rowHeight: 80,
      widgets: [
        {
          id: 'w1',
          type: 'clock',
          title: 'Clock',
          config: { showSeconds: true },
          layout: { x: 0, y: 0, w: 2, h: 2 },
        },
      ],
    },
  ],
  activeViewId: 'v1',
  rotation: { enabled: false, intervalMs: 30000 },
  themes: [],
  activeThemeId: null,
  settings: {},
};

describe('registerWidget', () => {
  it('looks up a registered type', () => {
    registerWidget({
      type: 'clock',
      name: 'Clock',
      description: 'Time',
      icon: Dummy,
      component: Dummy,
      defaultConfig: { showSeconds: true },
      defaultLayout: { w: 3, h: 2 },
    });
    expect(getWidgetByType('clock')?.name).toBe('Clock');
    expect(getWidgetTypes().map((e) => e.type)).toEqual(['clock']);
  });

  it('registers configSchema with @homeslate/schema', () => {
    registerWidget({
      type: 'clock',
      name: 'Clock',
      description: 'Time',
      icon: Dummy,
      component: Dummy,
      defaultConfig: {},
      defaultLayout: { w: 3, h: 2 },
      configSchema: z.object({ showSeconds: z.boolean().optional() }),
    });
    const invalid = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [
            {
              ...validDoc.views[0].widgets[0],
              config: { showSeconds: 'yes' },
            },
          ],
        },
      ],
    });
    expect(invalid.ok).toBe(false);

    const valid = validateDisplayDocument(validDoc);
    expect(valid.ok).toBe(true);
  });

  it('accepts a custom type with no configSchema', () => {
    registerWidget({
      type: 'custom-weather',
      name: 'Custom',
      description: 'Host widget',
      icon: Dummy,
      component: Dummy,
      defaultConfig: { foo: 1 },
      defaultLayout: { w: 2, h: 2 },
    });
    expect(getWidgetByType('custom-weather')?.type).toBe('custom-weather');
    const result = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [
            {
              id: 'w2',
              type: 'custom-weather',
              title: 'X',
              config: { anything: true },
              layout: { x: 0, y: 0, w: 2, h: 2 },
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/widgets/src/registry.test.ts`

Expected: FAIL — cannot resolve `./registry`.

- [x] **Step 3: Implement types + registry**

`packages/widgets/src/types.ts`: copy `WidgetConfig`, `WidgetDefinition`, `WidgetProps`, `WidgetRegistryEntry` from `src/types/widget.ts` and add `configSchema?: ZodType` (import `ZodType` from `zod`, `ComponentType` from `react`). Do not include `TextAlign` yet unless a widget file needs it in Task 4; adding `export type TextAlign = 'left' | 'center' | 'right'` here is fine and avoids a later type chase.

`packages/widgets/src/registry.ts`:

```ts
import { registerWidgetConfigSchema } from '@homeslate/schema';
import type { WidgetConfig, WidgetRegistryEntry } from './types';

const widgetRegistry = new Map<string, WidgetRegistryEntry<WidgetConfig>>();

export function registerWidget<T extends WidgetConfig>(entry: WidgetRegistryEntry<T>): void {
  widgetRegistry.set(entry.type, entry as unknown as WidgetRegistryEntry<WidgetConfig>);
  if (entry.configSchema) {
    registerWidgetConfigSchema(entry.type, entry.configSchema);
  }
}

export function getWidgetTypes(): WidgetRegistryEntry<WidgetConfig>[] {
  return Array.from(widgetRegistry.values());
}

export function getWidgetByType(type: string): WidgetRegistryEntry<WidgetConfig> | undefined {
  return widgetRegistry.get(type);
}

export function clearWidgetRegistry(): void {
  widgetRegistry.clear();
}
```

Export the new symbols from `packages/widgets/src/index.ts` (keep `WIDGETS_PACKAGE_NAME`).

Export `clearWidgetConfigSchemas` from `packages/schema/src/index.ts` (already implemented in `validate.ts`).

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/widgets/src/registry.test.ts packages/schema/src/validate.test.ts`

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/widgets/src/types.ts packages/widgets/src/registry.ts packages/widgets/src/registry.test.ts packages/widgets/src/index.ts packages/schema/src/index.ts
git commit -m "feat: formalize registerWidget with configSchema hookup"
```

---

### Task 3: GoogleRuntime Context And Host Adapter

**Files:**
- Create: `packages/widgets/src/googleRuntime.tsx`
- Create: `packages/widgets/src/googleRuntime.test.ts`
- Create: `src/host/HostGoogleRuntime.tsx`
- Modify: `src/App.tsx`
- Modify: `packages/widgets/src/index.ts`

**Interfaces:**
- Consumes: `useAuth` from `src/contexts/AuthContext.tsx`; `useDisplayId` / `useIsPreviewDisplay` from `src/contexts/DisplayContext.tsx`
- Produces:

```ts
export type GoogleRuntime = {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => void;
  refreshAccessToken: () => Promise<string | null>;
  displayId: string | null;
  isPreview: boolean;
  /** Host HTTP prefix for kiosk calendar. Default `/api`. */
  kioskFetchBaseUrl: string;
};

export function GoogleRuntimeProvider(props: {
  value: GoogleRuntime;
  children: ReactNode;
}): JSX.Element;

export function useGoogleRuntime(): GoogleRuntime;
```

Default runtime (used when no provider):

```ts
export const DEFAULT_GOOGLE_RUNTIME: GoogleRuntime = {
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  signIn: () => {},
  refreshAccessToken: async () => null,
  displayId: null,
  isPreview: false,
  kioskFetchBaseUrl: '/api',
};
```

`useGoogleRuntime` must **not** throw. Return `DEFAULT_GOOGLE_RUNTIME` when context is null.

- [x] **Step 1: Write the failing test**

Create `packages/widgets/src/googleRuntime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_GOOGLE_RUNTIME } from './googleRuntime';

describe('DEFAULT_GOOGLE_RUNTIME', () => {
  it('is signed out with the hosted /api kiosk prefix', () => {
    expect(DEFAULT_GOOGLE_RUNTIME.isAuthenticated).toBe(false);
    expect(DEFAULT_GOOGLE_RUNTIME.accessToken).toBeNull();
    expect(DEFAULT_GOOGLE_RUNTIME.displayId).toBeNull();
    expect(DEFAULT_GOOGLE_RUNTIME.kioskFetchBaseUrl).toBe('/api');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/widgets/src/googleRuntime.test.ts`

Expected: FAIL — cannot resolve `./googleRuntime`.

- [x] **Step 3: Implement context + host adapter**

`packages/widgets/src/googleRuntime.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';

export type GoogleRuntime = {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => void;
  refreshAccessToken: () => Promise<string | null>;
  displayId: string | null;
  isPreview: boolean;
  kioskFetchBaseUrl: string;
};

export const DEFAULT_GOOGLE_RUNTIME: GoogleRuntime = {
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  signIn: () => {},
  refreshAccessToken: async () => null,
  displayId: null,
  isPreview: false,
  kioskFetchBaseUrl: '/api',
};

const GoogleRuntimeContext = createContext<GoogleRuntime | null>(null);

export function GoogleRuntimeProvider({
  value,
  children,
}: {
  value: GoogleRuntime;
  children: ReactNode;
}) {
  return <GoogleRuntimeContext.Provider value={value}>{children}</GoogleRuntimeContext.Provider>;
}

export function useGoogleRuntime(): GoogleRuntime {
  return useContext(GoogleRuntimeContext) ?? DEFAULT_GOOGLE_RUNTIME;
}
```

Export `GoogleRuntime`, `GoogleRuntimeProvider`, `useGoogleRuntime`, `DEFAULT_GOOGLE_RUNTIME` from the package index.

`src/host/HostGoogleRuntime.tsx`:

```tsx
import type { ReactNode } from 'react';
import { GoogleRuntimeProvider, type GoogleRuntime } from '@homeslate/widgets';
import { useAuth } from '../contexts/AuthContext';
import { useDisplayId, useIsPreviewDisplay } from '../contexts/DisplayContext';

export function HostGoogleRuntime({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const displayId = useDisplayId();
  const isPreview = useIsPreviewDisplay();
  const value: GoogleRuntime = {
    accessToken: auth.accessToken,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    signIn: auth.signIn,
    refreshAccessToken: auth.refreshAccessToken,
    displayId,
    isPreview,
    kioskFetchBaseUrl: '/api',
  };
  return <GoogleRuntimeProvider value={value}>{children}</GoogleRuntimeProvider>;
}
```

In `src/App.tsx`, wrap children of `AuthProvider` with `HostGoogleRuntime` (inside `AuthProvider`, around `ThemeProvider`).

- [x] **Step 4: Run tests + typecheck**

Run: `npx vitest run packages/widgets/src/googleRuntime.test.ts packages/widgets/src/index.test.ts`

Expected: PASS

Run: `npx tsc -b --pretty false`

Expected: exit 0

- [x] **Step 5: Commit**

```bash
git add packages/widgets/src/googleRuntime.tsx packages/widgets/src/googleRuntime.test.ts packages/widgets/src/index.ts src/host/HostGoogleRuntime.tsx src/App.tsx
git commit -m "feat: add GoogleRuntime context provided by the host"
```

---

### Task 4: Move Built-Ins, Hooks, And Widget Services Into The Package

**Files:**
- Move (git mv) the lists below into `packages/widgets/src/`
- Create shims at the old paths
- Modify: `packages/widgets/src/index.ts`, `packages/widgets/src/builtins.ts`
- Modify: `src/types/widget.ts` to re-export registry types from the package
- Modify remaining host files that imported moved modules (import from `@homeslate/widgets` or the shim)

**Interfaces:**
- Consumes: Task 2 registry; Task 3 `useGoogleRuntime` (Google retarget is Task 5 — this task may still compile with `useAuth` if files keep those imports, but after the move those imports **must not** point at `src/` from inside the package)
- Produces: built-in widgets live under `packages/widgets`; host still renders them via shims

This task is a carve, not a rewrite. After it, **no file under `packages/widgets/` may import from `src/`**.

#### Move map

Create directories: `packages/widgets/src/widgets`, `hooks`, `services`, `chrome`, `alarms`, `timers`, `store`.

```bash
# widgets (components, css, local helpers, existing tests)
git mv src/widgets/ClockWidget.tsx src/widgets/ClockWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/ClockWidget.module.test.ts packages/widgets/src/widgets/
git mv src/widgets/CalendarWidget.tsx src/widgets/CalendarWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/GoogleCalendarWidget.tsx src/widgets/GoogleCalendarWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/GoogleCalendarMonthWidget.tsx src/widgets/GoogleCalendarMonthWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/GoogleCalendarDayWidget.tsx src/widgets/GoogleCalendarDayWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/WeekCalendarWidget.tsx src/widgets/WeekCalendarWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/PhotoWidget.tsx src/widgets/PhotoWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/GooglePhotoCollageWidget.tsx src/widgets/GooglePhotoCollageWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/GooglePhotosWidget.tsx src/widgets/GooglePhotosWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/WeatherWidget.tsx src/widgets/WeatherWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/weatherSizeTier.ts src/widgets/weatherSizeTier.test.ts packages/widgets/src/widgets/
git mv src/widgets/NewsWidget.tsx src/widgets/NewsWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/StocksWidget.tsx src/widgets/StocksWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/TodoWidget.tsx src/widgets/TodoWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/SportsWidget.tsx src/widgets/SportsWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/AlarmsWidget.tsx src/widgets/AlarmsWidget.module.css packages/widgets/src/widgets/
git mv src/widgets/TimersWidget.tsx src/widgets/TimersWidget.module.css src/widgets/TimersWidget.test.ts packages/widgets/src/widgets/
git mv src/widgets/googleCalendarError.ts src/widgets/googleCalendarError.test.ts packages/widgets/src/widgets/
git mv src/widgets/widgetThemeTokens.test.ts packages/widgets/src/widgets/

# chrome used only by widgets (+ WidgetWrapper type)
git mv src/components/WidgetDataStatus.tsx packages/widgets/src/chrome/WidgetDataStatus.tsx
git mv src/components/GoogleCalendarEmptyState.tsx packages/widgets/src/chrome/GoogleCalendarEmptyState.tsx

# hooks used only by widgets
git mv src/hooks/useCalendar.ts packages/widgets/src/hooks/
git mv src/hooks/useNews.ts packages/widgets/src/hooks/
git mv src/hooks/useWeather.ts packages/widgets/src/hooks/
git mv src/hooks/useStocks.ts packages/widgets/src/hooks/
git mv src/hooks/useScores.ts packages/widgets/src/hooks/
git mv src/hooks/useGoogleCalendar.ts packages/widgets/src/hooks/
git mv src/hooks/useDisplayCalendar.ts packages/widgets/src/hooks/
git mv src/hooks/useGooglePhotos.ts packages/widgets/src/hooks/
git mv src/hooks/useGooglePhotoCollage.ts packages/widgets/src/hooks/
git mv src/hooks/polling.ts src/hooks/polling.test.ts packages/widgets/src/hooks/

# services used only by those hooks/widgets
git mv src/services/calendar.ts packages/widgets/src/services/
git mv src/services/news.ts packages/widgets/src/services/
git mv src/services/weather.ts packages/widgets/src/services/
git mv src/services/hourlyForecast.ts src/services/hourlyForecast.test.ts packages/widgets/src/services/
git mv src/services/stocks.ts packages/widgets/src/services/
git mv src/services/sports.ts packages/widgets/src/services/
git mv src/services/googleCalendar.ts packages/widgets/src/services/
git mv src/services/googlePhotos.ts packages/widgets/src/services/

git mv src/store/calendarCacheStore.ts packages/widgets/src/store/calendarCacheStore.ts

# alarms consumed by AlarmsWidget (runtime stays in src/alarms)
git mv src/alarms/AlarmsContext.tsx packages/widgets/src/alarms/AlarmsContext.tsx
git mv src/alarms/AlarmListEditor.tsx src/alarms/AlarmListEditor.module.css packages/widgets/src/alarms/

# timers consumed by TimersWidget
mkdir -p packages/widgets/src/timers
git mv src/timers/TimersContext.tsx src/timers/format.ts src/timers/types.ts packages/widgets/src/timers/
```

Leave in place (do not move): `src/widgets/registry.ts`, `src/widgets/index.ts` — replace with shims after builtins exist.

Do not move: `useWakeLock`, `useFullscreen`, `useViewRotation`, `apiClient`, `displayCalendarAuth`, `AlarmRuntime`, `AlarmDialog`, `tones.ts`, `schedule.ts`, `alertQueue.ts`, `alertTypes.ts`.

- [x] **Step 1: Move files, then rewrite imports inside the package**

Rewrite rules (apply to every moved file):

| Old import | New import |
|---|---|
| `from '../types/widget'` | `from '../types'` (or `../../types` from nested dirs) |
| `from '../hooks/useX'` | `from '../hooks/useX'` (adjust relative depth) |
| `from '../services/X'` | `from '../services/X'` |
| `from '../components/WidgetDataStatus'` | `from '../chrome/WidgetDataStatus'` |
| `from '../components/GoogleCalendarEmptyState'` | `from '../chrome/GoogleCalendarEmptyState'` |
| `from '../alarms/AlarmsContext'` | `from '../alarms/AlarmsContext'` |
| `from '../alarms/AlarmListEditor'` | `from '../alarms/AlarmListEditor'` |
| `from '../alarms/types'` | `type AlarmToneId` from `@homeslate/schema`; `ALARM_TONE_OPTIONS` from `../alarms/tones` (create that file; see below) |
| `from '../timers/...'` | `from '../timers/...'` |
| `from '../store/calendarCacheStore'` | `from '../store/calendarCacheStore'` |
| `from '../contexts/AuthContext'` | **delete in Task 5**; this task must not leave this import in the package |
| `from '../contexts/DisplayContext'` | **delete in Task 5** |
| `from '../services/displayCalendarAuth'` | copy `isFatalGoogleAuthFailure` into `widgets/googleCalendarError.ts` (one-liner: `reason === 'invalid_grant' \|\| reason === 'token_revoked'`) and import that. Do not import `src/services/displayCalendarAuth`. |
| `from './schedule'` in `AlarmListEditor` | copy `isValidTime` into `packages/widgets/src/alarms/isValidTime.ts` (`/^([01]\d\|2[0-3]):([0-5]\d)$/`). Leave `src/alarms/schedule.ts` as the runtime copy. |

Create `packages/widgets/src/alarms/tones.ts`:

```ts
import type { AlarmToneId } from '@homeslate/schema';

export const ALARM_TONE_OPTIONS: { value: AlarmToneId; label: string }[] = [
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'radar', label: 'Radar' },
];
```

`TimersContext` currently imports `AlertQueueItem` from `../alarms/alertTypes`. Keep using a structurally identical type declared in `packages/widgets/src/timers/alert.ts`:

```ts
import type { AlarmToneId } from '@homeslate/schema';

export type TimerAlertPayload = {
  kind: 'timer';
  id: string;
  label: string;
  subtitle: string;
  toneId: AlarmToneId;
  timer: {
    runId: string;
    durationSeconds: number;
    label: string;
    toneId: AlarmToneId;
    presetId?: string;
  };
};
```

Point `TimersContext` `EnqueueFn` at `(item: TimerAlertPayload) => void`. `src/alarms/AlarmRuntime.tsx` still passes `enqueueOne` whose argument is `AlertQueueItem`. Structural typing accepts `TimerAlertPayload` as an `AlertQueueItem` (`kind: 'timer'` plus the same `timer` fields). If `tsc` complains about extra/missing fields, widen `EnqueueFn` to `(item: TimerAlertPayload | AlertQueueItem) => void` **in the host shim**, not by importing `src` into the package.

`AlarmListEditor` uses `AlarmDefinition` from local types — import `AlarmDefinition` from `@homeslate/schema`.

For **this task only**, Google widgets/hooks still need auth. Implement the Task 5 swap **as part of the import rewrite** so the package never imports `src/contexts/*`. Treat Task 5 as the detailed GoogleRuntime replacement; if you do it here, skip duplicating that work in Task 5 and only add Task 5’s tests.

Minimum Google swap required for this task to compile (full behavior in Task 5):

- `useGoogleCalendar`: `const { accessToken, isAuthenticated, refreshAccessToken } = useGoogleRuntime();`
- `useGooglePhotos`: `const { accessToken, isAuthenticated } = useGoogleRuntime();`
- Widget files that call `useAuth()` / `useDisplayId` / `useIsPreviewDisplay`: switch to `useGoogleRuntime()`.
- `useDisplayCalendar` fetch URL: `` `${kioskFetchBaseUrl}/display-calendar?${params}` `` instead of `` `/api/display-calendar?${params}` ``. Read `kioskFetchBaseUrl` from `useGoogleRuntime()` (ignore `displayId` argument if you prefer; keep the hook’s current `displayId` argument and pass `runtime.displayId` from widgets — widgets already pass `useDisplayId()`). After the swap, widgets pass `useGoogleRuntime().displayId`.

`isDisplayMode` in calendar widgets today is derived from display id / preview. Keep that logic; source the ids from `useGoogleRuntime()`.

- [x] **Step 2: Builtins module + package index**

Move the **body** of `src/widgets/registry.ts` (lazy imports + `setWidgetEntry` calls) into `packages/widgets/src/builtins.ts`. Replace `setWidgetEntry` with `registerWidget(...)`. Do not add `configSchema` yet (Task 6).

`packages/widgets/src/index.ts` must:

```ts
import './builtins'; // side-effect: register built-ins
export const WIDGETS_PACKAGE_NAME = '@homeslate/widgets';
export { registerWidget, getWidgetByType, getWidgetTypes, clearWidgetRegistry } from './registry';
export type { WidgetConfig, WidgetDefinition, WidgetProps, WidgetRegistryEntry, TextAlign } from './types';
export { GoogleRuntimeProvider, useGoogleRuntime, DEFAULT_GOOGLE_RUNTIME } from './googleRuntime';
export type { GoogleRuntime } from './googleRuntime';
export { AlarmsProvider, useAlarms } from './alarms/AlarmsContext';
export { AlarmListEditor } from './alarms/AlarmListEditor';
export { ALARM_TONE_OPTIONS } from './alarms/tones';
export { TimersProvider, useTimers } from './timers/TimersContext';
export { coerceTimerPresets } from './widgets/TimersWidget';
export type { ClockConfig } from './widgets/ClockWidget';
export type { TodoItem, TodoConfig } from './widgets/TodoWidget';
export type { Photo, UrlPhoto, StoredPhoto, PhotoConfig } from './widgets/PhotoWidget';
export { loadStoredImage } from './services/googlePhotos';
export { useGooglePhotos } from './hooks/useGooglePhotos';
export type { WidgetHealthStatus } from './chrome/WidgetDataStatus';
```

Export whatever host files currently import from moved modules. At minimum host still needs: `getWidgetByType`, `getWidgetTypes`, `registerWidget`, `TodoItem`, `Photo` / `loadStoredImage`, `useGooglePhotos`, `AlarmsProvider`, `useAlarms`, `AlarmListEditor`, `TimersProvider`, `useTimers`, `ALARM_TONE_OPTIONS` / `AlarmToneId` (host `src/alarms/types.ts` can keep exporting `AlarmDefinition` from `@homeslate/schema` and `ALARM_TONE_OPTIONS` from `@homeslate/widgets`).

- [x] **Step 3: Host shims**

Replace `src/widgets/registry.ts` with:

```ts
export { getWidgetTypes, getWidgetByType, registerWidget } from '@homeslate/widgets';
```

Replace `src/widgets/index.ts` so existing `from '../widgets/TodoWidget'`-style imports still work **or** update those host imports to `@homeslate/widgets`. Prefer updating host imports that already named a moved file:

| Host file | New import |
|---|---|
| `src/components/WidgetWrapper.tsx` | `getWidgetByType` from `@homeslate/widgets`; `WidgetHealthStatus` from `@homeslate/widgets` |
| `src/components/AddWidgetPanel.tsx` | `getWidgetTypes` from `@homeslate/widgets` |
| `src/components/WidgetPanel.tsx` | `getWidgetTypes`, `useGooglePhotos`, `loadStoredImage` from `@homeslate/widgets` |
| `src/pages/DisplayDetailPage.tsx` | `getWidgetByType`, `AlarmListEditor` from `@homeslate/widgets` |
| `src/pages/ViewEditorPage.tsx` | `AlarmsProvider`, `TimersProvider` from `@homeslate/widgets` |
| `src/components/DisplayViewer.tsx` | `AlarmsProvider`, `TimersProvider`, `useTimers`, `TodoItem` from `@homeslate/widgets` |
| `src/components/BackgroundSlideshow.tsx` | `loadStoredImage` from `@homeslate/widgets` |
| `src/alarms/AlarmRuntime.tsx` / `DisplayViewer` timer enqueue | `useTimers` from `@homeslate/widgets` |
| `src/alarms/types.ts` | `export type { AlarmDefinition, AlarmToneId } from '@homeslate/schema'` and keep `SNOOZE_MINUTES` locally; `ALARM_TONE_OPTIONS` re-exported from `@homeslate/widgets` |

`src/types/widget.ts`: delete `WidgetConfig` / `WidgetDefinition` / `WidgetProps` / `WidgetRegistryEntry` (now in the package). Re-export them:

```ts
export type {
  WidgetConfig,
  WidgetDefinition,
  WidgetProps,
  WidgetRegistryEntry,
  TextAlign,
} from '@homeslate/widgets';
export type { Photo } from '@homeslate/widgets';
```

Keep `StickyNote` and `DashboardLayout` here. `DashboardLayout.backgroundPhotos` still uses `Photo[]`.

Shims for moved hooks/services (so any missed import keeps working):

`src/hooks/useGooglePhotos.ts`:

```ts
export { useGooglePhotos } from '@homeslate/widgets';
export type { PickerStatus, CurrentPhoto } from '@homeslate/widgets';
```

Only add a shim if the type is already exported from the package; otherwise export those types from the package index from the moved hook file.

Repeat a one-line re-export shim for every moved hook/service that `src/` still imports. Grep after the move:

```bash
rg "from '\\.\\./(hooks|services|widgets|alarms|timers|store)/" src --glob '*.ts*'
rg "from '\\./(ClockWidget|TodoWidget|registry)'" src --glob '*.ts*'
```

Every remaining hit must resolve (shim or updated import). **Zero** hits from `packages/widgets` into `src`.

```bash
rg "from '\\.\\./(\\.\\./)*src/" packages/widgets
rg "contexts/AuthContext|contexts/DisplayContext|services/displayCalendarAuth" packages/widgets
```

Expected: no matches.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/widgets/src packages/schema/src src/widgets src/hooks/polling.test.ts`

Expected: PASS (paths that moved now live under `packages/widgets`; `src/hooks/polling.test.ts` was moved — run `packages/widgets/src/hooks/polling.test.ts` instead).

Also run the previous host tests that imported widget modules:

Run: `npx vitest run src packages/widgets/src packages/schema/src packages/google/src`

Expected: PASS

Run: `npx tsc -b --pretty false`

Expected: exit 0

If `widgetThemeTokens.test.ts` still looks at `dirname(import.meta.url)`, it now sits next to the CSS files in `packages/widgets/src/widgets` — no change needed.

- [x] **Step 5: Commit**

```bash
git add -A packages/widgets src/widgets src/hooks src/services src/components/WidgetDataStatus.tsx src/components/GoogleCalendarEmptyState.tsx src/store/calendarCacheStore.ts src/alarms src/timers src/types/widget.ts src/host src/App.tsx src/components src/pages
git commit -m "refactor: move built-in widgets into @homeslate/widgets"
```

Do not `git add` secrets or unrelated dirty files. If `git status` shows unrelated docs, leave them out.

---

### Task 5: Finish GoogleRuntime Retarget And Kiosk URL

**Files:**
- Modify: `packages/widgets/src/hooks/useGoogleCalendar.ts`
- Modify: `packages/widgets/src/hooks/useGooglePhotos.ts`
- Modify: `packages/widgets/src/hooks/useDisplayCalendar.ts`
- Modify: Google calendar/photo widget files if any `useAuth` remains
- Test: `packages/widgets/src/hooks/useDisplayCalendar.test.ts`

**Interfaces:**
- Consumes: `useGoogleRuntime()` from Task 3
- Produces: widgets/hooks never call `useAuth` / `useDisplayId`

If Task 4 already completed the swap, this task only adds the kiosk URL test and a grep gate.

- [x] **Step 1: Write the failing kiosk URL test**

Create `packages/widgets/src/hooks/useDisplayCalendar.test.ts`. The hook uses React state; do **not** add a jsdom renderer if the repo has none. Extract the URL builder instead:

In `useDisplayCalendar.ts`, export:

```ts
export function displayCalendarUrl(
  kioskFetchBaseUrl: string,
  params: { displayId: string; calendarIds: string; daysAhead: number }
): string {
  const search = new URLSearchParams({
    displayId: params.displayId,
    calendarIds: params.calendarIds,
    daysAhead: String(params.daysAhead),
  });
  return `${kioskFetchBaseUrl}/display-calendar?${search}`;
}
```

Use it in `fetchData`. Test:

```ts
import { describe, expect, it } from 'vitest';
import { displayCalendarUrl } from './useDisplayCalendar';

describe('displayCalendarUrl', () => {
  it('prefixes the host kiosk base URL', () => {
    expect(
      displayCalendarUrl('/api', {
        displayId: 'abc',
        calendarIds: 'cal1',
        daysAhead: 30,
      })
    ).toBe('/api/display-calendar?displayId=abc&calendarIds=cal1&daysAhead=30');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/widgets/src/hooks/useDisplayCalendar.test.ts`

Expected: FAIL — `displayCalendarUrl` not exported (if Task 4 already inlined a template string without exporting, the test fails on import).

- [x] **Step 3: Implement URL helper + grep gate**

Implement `displayCalendarUrl`. Confirm widgets use `useGoogleRuntime()`.

Grep gate (must be empty):

```bash
rg "useAuth|AuthContext|useDisplayId|useIsPreviewDisplay" packages/widgets
```

- [x] **Step 4: Run tests**

Run: `npx vitest run packages/widgets/src/hooks/useDisplayCalendar.test.ts packages/widgets/src/widgets/googleCalendarError.test.ts packages/widgets/src/registry.test.ts`

Expected: PASS

Run: `npx tsc -b --pretty false`

Expected: exit 0

- [x] **Step 5: Commit**

```bash
git add packages/widgets/src/hooks/useDisplayCalendar.ts packages/widgets/src/hooks/useDisplayCalendar.test.ts packages/widgets/src/hooks/useGoogleCalendar.ts packages/widgets/src/hooks/useGooglePhotos.ts packages/widgets/src/widgets
git commit -m "refactor: read Google session from GoogleRuntime"
```

---

### Task 6: Built-In configSchemas And Server Registration

**Files:**
- Create: `packages/widgets/src/configSchemas.ts`
- Create: `packages/widgets/src/schemas.ts`
- Create: `packages/widgets/src/configSchemas.test.ts`
- Modify: `packages/widgets/src/builtins.ts` (attach `configSchema` on each `registerWidget` call)
- Modify: `src/displayDocumentBridge.ts`

**Interfaces:**
- Consumes: `registerWidgetConfigSchema` from `@homeslate/schema`; Zod 4
- Produces: `registerBuiltInWidgetConfigSchemas(): void`; importing `@homeslate/widgets/schemas` registers all 15 built-in types; `writeStoredConfig` rejects invalid clock config

Built-in types (must all be registered; names are today’s `type` strings):

`clock`, `calendar`, `google-calendar`, `google-calendar-month`, `google-calendar-day`, `photo`, `google-photo-collage`, `weather`, `news`, `stocks`, `week-calendar`, `todo`, `sports`, `alarms`, `timers`.

That is 15 types. Do not register `GooglePhotosWidget`.

Config schemas — every key `.optional()`, no `.strict()`:

```ts
import { registerWidgetConfigSchema } from '@homeslate/schema';
import { z } from 'zod';

const textAlign = z.enum(['left', 'center', 'right']);

export const clockConfigSchema = z.object({
  showSeconds: z.boolean().optional(),
  showDate: z.boolean().optional(),
  use24Hour: z.boolean().optional(),
  timezone: z.string().optional(),
  transparentBackground: z.boolean().optional(),
  textAlign: textAlign.optional(),
});

export const calendarConfigSchema = z.object({
  icalUrl: z.string().optional(),
  showWeekNumbers: z.boolean().optional(),
  maxEvents: z.number().optional(),
  daysAhead: z.number().optional(),
  showCalendar: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const googleCalendarConfigSchema = z.object({
  clientId: z.string().optional(),
  selectedCalendarIds: z.array(z.string()).optional(),
  maxEvents: z.number().optional(),
  daysAhead: z.number().optional(),
  showCalendar: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const googleCalendarMonthConfigSchema = z.object({
  selectedCalendarIds: z.array(z.string()).optional(),
  daysAhead: z.number().optional(),
  transparentBackground: z.boolean().optional(),
});

export const googleCalendarDayConfigSchema = z.object({
  selectedCalendarIds: z.array(z.string()).optional(),
  maxEvents: z.number().optional(),
  daysAhead: z.number().optional(),
  transparentBackground: z.boolean().optional(),
});

export const weekCalendarConfigSchema = z.object({
  selectedCalendarIds: z.array(z.string()).optional(),
  viewMode: z.enum(['calendar-week', 'rolling-7']).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
  startHour: z.number().optional(),
  endHour: z.number().optional(),
  transparentBackground: z.boolean().optional(),
});

const urlPhoto = z.object({ type: z.literal('url'), url: z.string(), caption: z.string().optional() });
const storedPhoto = z.object({
  type: z.literal('stored'),
  key: z.string(),
  filename: z.string(),
  caption: z.string().optional(),
  previewUrl: z.string().optional(),
});
const photo = z.union([urlPhoto, storedPhoto]);

export const photoConfigSchema = z.object({
  photos: z.array(photo).optional(),
  interval: z.number().optional(),
  transition: z.enum(['fade', 'slide', 'none']).optional(),
  showCaption: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const googlePhotoCollageConfigSchema = z.object({
  rotationInterval: z.number().optional(),
  transparentBackground: z.boolean().optional(),
  photos: z.array(photo).optional(),
});

export const weatherConfigSchema = z.object({
  location: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  units: z.enum(['imperial', 'metric']).optional(),
  showForecast: z.boolean().optional(),
  forecastDays: z.number().optional(),
  transparentBackground: z.boolean().optional(),
  showAirQuality: z.boolean().optional(),
  textAlign: textAlign.optional(),
});

export const newsConfigSchema = z.object({
  feedUrls: z.array(z.string()).optional(),
  maxItems: z.number().optional(),
  showSource: z.boolean().optional(),
  showDescription: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const stocksConfigSchema = z.object({
  symbols: z.array(z.string()).optional(),
  apiKey: z.string().optional(),
  showChange: z.boolean().optional(),
  showDayRange: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const todoConfigSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        checked: z.boolean(),
      })
    )
    .optional(),
  hideCompleted: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const sportsConfigSchema = z.object({
  leagueId: z.string().optional(),
  favoriteTeamIds: z.array(z.string()).optional(),
  showAllGames: z.boolean().optional(),
  showCurrentGames: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const alarmsConfigSchema = z.object({
  transparentBackground: z.boolean().optional(),
});

export const timersConfigSchema = z.object({
  presets: z.array(z.unknown()).optional(),
  transparentBackground: z.boolean().optional(),
});

export const BUILTIN_WIDGET_CONFIG_SCHEMAS: Record<string, z.ZodType> = {
  clock: clockConfigSchema,
  calendar: calendarConfigSchema,
  'google-calendar': googleCalendarConfigSchema,
  'google-calendar-month': googleCalendarMonthConfigSchema,
  'google-calendar-day': googleCalendarDayConfigSchema,
  photo: photoConfigSchema,
  'google-photo-collage': googlePhotoCollageConfigSchema,
  weather: weatherConfigSchema,
  news: newsConfigSchema,
  stocks: stocksConfigSchema,
  'week-calendar': weekCalendarConfigSchema,
  todo: todoConfigSchema,
  sports: sportsConfigSchema,
  alarms: alarmsConfigSchema,
  timers: timersConfigSchema,
};

export function registerBuiltInWidgetConfigSchemas(): void {
  for (const [type, schema] of Object.entries(BUILTIN_WIDGET_CONFIG_SCHEMAS)) {
    registerWidgetConfigSchema(type, schema);
  }
}
```

`packages/widgets/src/schemas.ts`:

```ts
import { registerBuiltInWidgetConfigSchemas } from './configSchemas';

registerBuiltInWidgetConfigSchemas();

export { registerBuiltInWidgetConfigSchemas, BUILTIN_WIDGET_CONFIG_SCHEMAS } from './configSchemas';
```

This file must not import React, `./builtins`, or any `.tsx`.

In `packages/widgets/src/builtins.ts`, pass the matching `configSchema` into each `registerWidget({ ..., configSchema: clockConfigSchema })`. Import schemas from `./configSchemas`. Double registration (builtins + schemas entry) is a Map set; identical schemas are fine.

`src/displayDocumentBridge.ts` — add as the first import:

```ts
import '@homeslate/widgets/schemas';
```

- [x] **Step 1: Write the failing tests**

Create `packages/widgets/src/configSchemas.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearWidgetConfigSchemas,
  validateDisplayDocument,
} from '@homeslate/schema';
import {
  BUILTIN_WIDGET_CONFIG_SCHEMAS,
  registerBuiltInWidgetConfigSchemas,
} from './configSchemas';

afterEach(() => {
  clearWidgetConfigSchemas();
});

const baseDoc = {
  schemaVersion: 1 as const,
  name: 'Kitchen',
  views: [
    {
      id: 'v1',
      name: 'Main',
      columns: 12,
      rowHeight: 80,
      widgets: [] as Array<{
        id: string;
        type: string;
        title: string;
        config: Record<string, unknown>;
        layout: { x: number; y: number; w: number; h: number };
      }>,
    },
  ],
  activeViewId: 'v1',
  rotation: { enabled: false, intervalMs: 30000 },
  themes: [],
  activeThemeId: null,
  settings: {},
};

function docWith(type: string, config: Record<string, unknown>) {
  return {
    ...baseDoc,
    views: [
      {
        ...baseDoc.views[0],
        widgets: [
          {
            id: 'w1',
            type,
            title: type,
            config,
            layout: { x: 0, y: 0, w: 2, h: 2 },
          },
        ],
      },
    ],
  };
}

describe('built-in widget config schemas', () => {
  it('registers every built-in type', () => {
    expect(Object.keys(BUILTIN_WIDGET_CONFIG_SCHEMAS).sort()).toEqual(
      [
        'alarms',
        'calendar',
        'clock',
        'google-calendar',
        'google-calendar-day',
        'google-calendar-month',
        'google-photo-collage',
        'news',
        'photo',
        'sports',
        'stocks',
        'timers',
        'todo',
        'weather',
        'week-calendar',
      ].sort()
    );
  });

  it('rejects a clock with a non-boolean showSeconds', () => {
    registerBuiltInWidgetConfigSchemas();
    const result = validateDisplayDocument(docWith('clock', { showSeconds: 'yes' }));
    expect(result.ok).toBe(false);
  });

  it('accepts a clock missing optional keys', () => {
    registerBuiltInWidgetConfigSchemas();
    const result = validateDisplayDocument(docWith('clock', {}));
    expect(result.ok).toBe(true);
  });

  it('still accepts an unknown type with object config', () => {
    registerBuiltInWidgetConfigSchemas();
    const result = validateDisplayDocument(docWith('mystery-widget', { anything: true }));
    expect(result.ok).toBe(true);
  });
});
```

The expected array is the 15 built-in type strings.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/widgets/src/configSchemas.test.ts`

Expected: FAIL — cannot resolve `./configSchemas`.

- [x] **Step 3: Implement schemas, attach to builtins, import from the bridge**

Implement `configSchemas.ts` and `schemas.ts` as specified. Wire `configSchema` on each builtin entry. Import `@homeslate/widgets/schemas` from `displayDocumentBridge.ts`.

Confirm `packages/widgets/src/schemas.ts` has no React imports:

```bash
rg "from 'react'|from \\\"react\\\"" packages/widgets/src/configSchemas.ts packages/widgets/src/schemas.ts
```

Expected: no matches.

- [x] **Step 4: Run tests**

Run: `npx vitest run packages/widgets/src/configSchemas.test.ts packages/widgets/src/registry.test.ts packages/schema/src/validate.test.ts src/displayDocumentBridge.test.ts`

Expected: PASS

Run: `npx tsc -b --pretty false`

Expected: exit 0

- [x] **Step 5: Commit**

```bash
git add packages/widgets/src/configSchemas.ts packages/widgets/src/schemas.ts packages/widgets/src/configSchemas.test.ts packages/widgets/src/builtins.ts src/displayDocumentBridge.ts
git commit -m "feat: register built-in widget config schemas"
```

---

### Task 7: Unknown Widget Placeholder

**Files:**
- Create: `packages/widgets/src/UnknownWidget.tsx`
- Create: `packages/widgets/src/UnknownWidget.test.ts`
- Modify: `packages/widgets/src/index.ts`
- Modify: `src/components/WidgetWrapper.tsx`

**Interfaces:**
- Consumes: `WidgetProps` from Task 2
- Produces: `UnknownWidget` showing `Unknown widget type: ${widget.type}` (same copy as today’s `WidgetWrapper` fallback)

- [x] **Step 1: Write the failing test**

`getWidgetByType` stays undefined for unknown types (do not auto-register). Test the component module by exporting a pure label helper to avoid jsdom:

```ts
export function unknownWidgetLabel(type: string): string {
  return `Unknown widget type: ${type}`;
}
```

`packages/widgets/src/UnknownWidget.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getWidgetByType } from './registry';
import { unknownWidgetLabel } from './UnknownWidget';

describe('unknown widgets', () => {
  it('does not resolve an unregistered type', () => {
    expect(getWidgetByType('mystery-widget')).toBeUndefined();
  });

  it('labels the missing type', () => {
    expect(unknownWidgetLabel('mystery-widget')).toBe('Unknown widget type: mystery-widget');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/widgets/src/UnknownWidget.test.ts`

Expected: FAIL — cannot resolve `./UnknownWidget`.

- [x] **Step 3: Implement placeholder and use it in WidgetWrapper**

`packages/widgets/src/UnknownWidget.tsx`:

```tsx
import { Paper, Text } from '@mantine/core';
import type { WidgetProps } from './types';

export function unknownWidgetLabel(type: string): string {
  return `Unknown widget type: ${type}`;
}

export function UnknownWidget({ widget }: WidgetProps) {
  return (
    <Paper p="md">
      <Text c="red">{unknownWidgetLabel(widget.type)}</Text>
    </Paper>
  );
}
```

Export `UnknownWidget` from the package index.

In `src/components/WidgetWrapper.tsx`, replace the inline unknown `Paper` with:

```tsx
import { UnknownWidget } from '@homeslate/widgets';
```

```tsx
if (!widgetEntry) {
  return <UnknownWidget widget={widget} isEditing={isEditing} onConfigChange={() => {}} />;
}
```

Keep the existing toolbar/settings UI for **registered** types unchanged.

- [x] **Step 4: Run tests**

Run: `npx vitest run packages/widgets/src/UnknownWidget.test.ts packages/widgets/src/registry.test.ts`

Expected: PASS

Run: `npx tsc -b --pretty false`

Expected: exit 0

- [x] **Step 5: Commit**

```bash
git add packages/widgets/src/UnknownWidget.tsx packages/widgets/src/UnknownWidget.test.ts packages/widgets/src/index.ts src/components/WidgetWrapper.tsx
git commit -m "feat: render a placeholder for unknown widget types"
```

---

## Self-review

**Spec coverage**

| Spec item | Task |
|---|---|
| `registerWidget()` + default registry | 2, 4 |
| Built-ins move to `@homeslate/widgets` | 4 |
| `configSchema` on `WidgetRegistryEntry`; registered next to widgets | 2, 6 |
| `registerWidgetConfigSchema` for built-ins; unknown types still round-trip | 6 |
| Google via `GoogleRuntime`; no hosted auth imports | 3, 5 |
| Missing Google tokens → empty state, no crash | 3 default runtime |
| Unknown `type` placeholder | 7 |
| No billing/quota in public package | all package files |
| Do not rewrite widget UX | 4 (git mv) |
| DisplayStore.put rejects invalid built-in config | 6 via `displayDocumentBridge` |
| Editor/display packages | Phase 4, not this plan |
| File/sqlite adapters + reference app | Phase 5 |
| GIS popup remains hosted `AuthContext` | 3 host adapter |

**Placeholder scan:** no TBD / “add tests for the above” / “similar to Task N” without code. Task 4 is a move map plus import tables rather than pasting every widget file.

**Type consistency:** `registerWidget` / `getWidgetByType` / `getWidgetTypes` names match today’s app. `GoogleRuntime.kioskFetchBaseUrl` default `'/api'`. Built-in `type` strings unchanged. `AlarmDefinition` stays `@homeslate/schema`. Host `DashboardLayout` stays in `src/types/widget.ts`.
