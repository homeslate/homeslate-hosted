# Theming Overhaul — Milestone 1: Foundation and Token Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `DisplayTheme` runtime model with a W3C Design Tokens `ThemeDocument` as the single source of truth, including alias-aware resolution, a new `--token-*` CSS variable namespace, and persistence/store/API updates. Add `vitest` and the seven test suites called out in the spec.

**Architecture:** Persistence holds `ThemeDocument`s per display (jsonb). At read time, `ThemeContext` picks the active document, calls a pure `resolveTheme(doc, mode, overrides?)` to produce a flat `ResolvedTheme`, runs `themeToVars(resolved)` to emit `--token-*` CSS custom properties on the viewer root, and bridges values into Mantine. Widgets read tokens via cascade only — `*.module.css` files are swept onto the new namespace via a fixed substitution table.

**Tech Stack:** TypeScript, React 19, Vite 7, Zustand 5 (with persist), Zod 4, Mantine 8, vitest 3 (added in this milestone), Drizzle ORM (jsonb storage), Netlify Functions.

**Spec reference:** [docs/superpowers/specs/2026-04-24-theming-overhaul-design.md](../specs/2026-04-24-theming-overhaul-design.md). This plan implements the M1 portion only; M2–M6 each get their own plan after the previous milestone ships.

**Working rules (from the spec):**

- No backward-compatibility code paths or v2 naming.
- Build for current app behavior first; optimize later.
- TDD: tests fail before they pass, every change ends in a focused commit.
- The legacy `DisplayTheme` and the legacy `--theme-*` namespace are deleted by the end of this milestone — no parallel runtime.

---

## File map

**Created**

- `src/themes/resolver.ts` — `resolveTheme`, `ThemeResolutionError`.
- `src/themes/resolver.test.ts` — alias / cycle / depth / cross-mode / mode / override tests.
- `src/themes/defaults.ts` — `DEFAULT_THEME_DOCUMENTS`, `THEME_PRESET_OPTIONS`, `getPresetById`, `pickActiveDocument`.
- `src/themes/defaults.test.ts` — every bundled default validates and resolves.
- `src/themes/utils.test.ts` — `themeToVars` snapshot + assertions, `hexToRgb` sanity.
- `src/themes/themeDocumentValidation.test.ts` — validator accept/reject suite.
- `src/themes/mantineBridge.ts` — `mantineThemeFromResolved`.
- `src/themes/index.test.ts` — `pickActiveDocument` fallback chain.
- `vitest.config.ts` — vitest configuration (separate file so vite build is unaffected).

**Modified**

- `src/types/theme.ts` — replace `DisplayTheme` with `ResolvedTheme`, `ThemeOverride`, `ColorMode`; re-export `ThemeDocument`.
- `src/themes/utils.ts` — rewrite `themeToVars` to consume `ResolvedTheme`; keep `hexToRgb`, `getBackgroundStyle`.
- `src/themes/themeDocumentValidation.ts` — add alias-syntax refinement.
- `src/themes/index.ts` — re-exports through new modules.
- `src/contexts/ThemeContext.tsx` — expose `{document, resolved, vars, colorMode, setColorMode}`.
- `src/store/dashboardStore.ts` — rename `themeDocuments → themes`, `activeThemeDocumentId → activeThemeId`; bump persist version 4 → 5; new actions.
- `src/types/api.ts` — new `ConfigUpsertRequest` shape.
- `netlify/functions/config.ts` — validate `themes[]`; reject unknown active id; strip legacy fields on read.
- `src/components/DisplayViewer.tsx` — consume the new context, drop direct `themeToVars(theme, mode)` call.
- `src/components/ThemePicker.tsx` — replace with minimal preset-picker (one Select that activates a bundled default).
- `src/App.tsx` — `mantineTheme` derived from active resolved theme via the bridge; `forceColorScheme` reads `colorMode` from context.
- `src/main.tsx` — set `document.documentElement.dataset.themeFallback = ''` on boot.
- `src/App.css` — drop legacy `--theme-*` and `--gradient-*`/`--glass-*`; add `:root[data-theme-fallback]` minimal set; body background switches to `var(--token-surface-canvas)`.
- 13 `*.module.css` files — substitution table sweep (see Task 17).
- `package.json` — `"test"` and `"test:run"` scripts; `vitest` devDep.
- `vite.config.ts` — `/// <reference types="vitest" />` line; nothing else (vitest config lives in `vitest.config.ts`).

**Deleted (Task 20, last)**

- `src/themes/presets.ts`
- `src/themes/themeDocumentPresets.ts`
- `src/themes/themeDocumentPreview.ts`

---

## Task 1: Add vitest and a smoke test

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `vite.config.ts`
- Create: `src/themes/__smoke__.test.ts`

- [ ] **Step 1: Install vitest as a devDependency**

```bash
npm install --save-dev vitest@^3
```

Expected: `package.json` `devDependencies` now includes a `"vitest"` key.

- [ ] **Step 2: Add npm scripts**

Edit `package.json` — under `"scripts"`, add `test` and `test:run`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:migrate:dev": "drizzle-kit migrate",
  "db:migrate:prod": "node scripts/db-migrate-prod.mjs",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Step 3: Add `vitest.config.ts`**

Create `vitest.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
    css: false,
  },
});
```

We use a dedicated config file so the production `vite.config.ts` (which loads the PWA plugin) stays untouched by test-only concerns.

- [ ] **Step 4: Write a smoke test**

Create `src/themes/__smoke__.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke test", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the smoke test**

Run: `npm run test:run`
Expected: `✓ src/themes/__smoke__.test.ts (1 test)` — pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/themes/__smoke__.test.ts
git commit -m "chore(theming): add vitest test runner with smoke test"
```

---

## Task 2: Stand up the new type model alongside the legacy one

We add `ResolvedTheme`, `ThemeOverride`, and the `ThemeDocument` re-export now so subsequent tasks can reference them. `DisplayTheme` and `ThemeModeColors` stay in place for now — they get deleted in Task 20 once every callsite has migrated.

**Files:**

- Modify: `src/types/theme.ts`

- [ ] **Step 1: Append the new exports**

Edit `src/types/theme.ts`. Keep the existing `DisplayTheme`, `ThemeModeColors`, and `ColorMode` exports — append these at the end:

```ts
import type { ThemeDocument } from "../themes/themeDocumentValidation";

export type { ThemeDocument };

interface StateTriplet {
  bg: string;
  fg: string;
  border: string;
}

interface InteractiveTriplet extends StateTriplet {
  hoverBg: string;
  activeBg: string;
}

export interface ResolvedTheme {
  foundation: {
    color: {
      brand: Record<string, string>;
      neutral: Record<string, string>;
      success: Record<string, string>;
      warning: Record<string, string>;
      danger: Record<string, string>;
      info?: Record<string, string>;
    };
    spacing: Record<string, string>;
    radius: Record<string, string>;
    typography: {
      family: { base: string; mono: string; display?: string };
      size: Record<string, string>;
      weight: Record<string, number>;
      lineHeight: Record<string, number>;
    };
    shadow?: Record<string, string>;
    opacity?: Record<string, number>;
    zIndex?: Record<string, number>;
    motion?: {
      duration?: Record<string, string>;
      easing?: Record<string, string>;
    };
  };
  semantic: {
    surface: { canvas: string; sunken: string; card: string; overlay: string };
    text: { primary: string; muted: string; inverse: string; link: string };
    border: { subtle: string; default: string; strong: string };
    focus: { ring: string; offset?: string };
    status: {
      success: StateTriplet;
      warning: StateTriplet;
      danger: StateTriplet;
      info?: StateTriplet;
    };
    interactive: {
      primary: InteractiveTriplet;
      secondary: InteractiveTriplet;
      ghost: InteractiveTriplet;
    };
  };
  components?: {
    widget?: {
      background?: string;
      borderColor?: string;
      borderWidth?: string;
      radius?: string;
      shadow?: string;
      padding?: string;
    };
    toolbar?: {
      background?: string;
      text?: string;
      icon?: string;
      divider?: string;
      height?: string;
    };
    badge?: {
      background?: string;
      text?: string;
      radius?: string;
      paddingX?: string;
      paddingY?: string;
    };
    control?: {
      height?: string;
      radius?: string;
      borderColor?: string;
      background?: string;
      text?: string;
      placeholder?: string;
    };
  };
  meta: { id: string; name: string; mode: ColorMode };
}

type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/** Override applied during theme resolution. Foundation tokens are global and not overridable. */
export type ThemeOverride = DeepPartial<{
  semantic: ThemeDocument["tokens"]["modes"]["dark"]["semantic"];
  components: ThemeDocument["tokens"]["modes"]["dark"]["components"];
}>;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — no new errors. (The file still has `DisplayTheme` and `ThemeModeColors`; that's intentional.)

- [ ] **Step 3: Commit**

```bash
git add src/types/theme.ts
git commit -m "feat(theming): introduce ResolvedTheme and ThemeOverride types"
```

---

## Task 3: Validator alias-syntax refinement

The Zod validator already accepts every leaf shape. We add a refinement that flags malformed alias syntax (unbalanced braces, empty path) without trying to verify the alias _target_ — target validity is checked by the resolver, because targets may exist in foundation but not in this mode block.

**Files:**

- Modify: `src/themes/themeDocumentValidation.ts`
- Create: `src/themes/themeDocumentValidation.test.ts`

- [ ] **Step 1: Write failing tests for the alias-syntax refinement**

Create `src/themes/themeDocumentValidation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateThemeDocument } from "./themeDocumentValidation";

function minimalDoc(): unknown {
  // Smallest doc that satisfies the strict schema. Used as a starting point
  // for tests that mutate one leaf at a time.
  return {
    id: "test",
    name: "Test",
    version: 1,
    isActive: true,
    tokens: {
      foundation: {
        color: {
          brand: { "500": { $type: "color", $value: "#6366f1" } },
          neutral: { "500": { $type: "color", $value: "#6b7280" } },
          success: { "500": { $type: "color", $value: "#22c55e" } },
          warning: { "500": { $type: "color", $value: "#f59e0b" } },
          danger: { "500": { $type: "color", $value: "#ef4444" } },
        },
        spacing: {
          "0": { $type: "dimension", $value: "0px" },
          "1": { $type: "dimension", $value: "4px" },
          "2": { $type: "dimension", $value: "8px" },
          "3": { $type: "dimension", $value: "12px" },
          "4": { $type: "dimension", $value: "16px" },
          "6": { $type: "dimension", $value: "24px" },
          "8": { $type: "dimension", $value: "32px" },
        },
        radius: {
          sm: { $type: "dimension", $value: "6px" },
          md: { $type: "dimension", $value: "10px" },
          lg: { $type: "dimension", $value: "14px" },
          full: { $type: "dimension", $value: "9999px" },
        },
        typography: {
          family: {
            base: { $type: "fontFamily", $value: "Inter, sans-serif" },
            mono: { $type: "fontFamily", $value: "monospace" },
          },
          size: {
            xs: { $type: "dimension", $value: "12px" },
            sm: { $type: "dimension", $value: "14px" },
            md: { $type: "dimension", $value: "16px" },
            lg: { $type: "dimension", $value: "18px" },
            xl: { $type: "dimension", $value: "20px" },
          },
          weight: {
            regular: { $type: "fontWeight", $value: 400 },
            medium: { $type: "fontWeight", $value: 500 },
            semibold: { $type: "fontWeight", $value: 600 },
            bold: { $type: "fontWeight", $value: 700 },
          },
          lineHeight: {
            tight: { $type: "number", $value: 1.2 },
            normal: { $type: "number", $value: 1.5 },
            relaxed: { $type: "number", $value: 1.75 },
          },
        },
      },
      modes: {
        dark: {
          semantic: {
            surface: {
              canvas: { $type: "color", $value: "#0a0a0f" },
              sunken: { $type: "color", $value: "#0a0a0f" },
              card: { $type: "color", $value: "#1e1e28" },
              overlay: { $type: "color", $value: "#1e1e28" },
            },
            text: {
              primary: { $type: "color", $value: "#e8e8f0" },
              muted: { $type: "color", $value: "#6c6c7e" },
              inverse: { $type: "color", $value: "#101828" },
              link: { $type: "color", $value: "#6366f1" },
            },
            border: {
              subtle: { $type: "color", $value: "rgba(255,255,255,0.08)" },
              default: { $type: "color", $value: "rgba(255,255,255,0.08)" },
              strong: { $type: "color", $value: "#6366f1" },
            },
            focus: { ring: { $type: "color", $value: "rgba(99,102,241,0.3)" } },
            status: {
              success: {
                bg: { $type: "color", $value: "#166534" },
                fg: { $type: "color", $value: "#dcfce7" },
                border: { $type: "color", $value: "#22c55e" },
              },
              warning: {
                bg: { $type: "color", $value: "#92400e" },
                fg: { $type: "color", $value: "#fef3c7" },
                border: { $type: "color", $value: "#f59e0b" },
              },
              danger: {
                bg: { $type: "color", $value: "#991b1b" },
                fg: { $type: "color", $value: "#fee2e2" },
                border: { $type: "color", $value: "#ef4444" },
              },
            },
            interactive: {
              primary: {
                bg: { $type: "color", $value: "#6366f1" },
                fg: { $type: "color", $value: "#ffffff" },
                border: { $type: "color", $value: "#6366f1" },
                hoverBg: { $type: "color", $value: "#5356d4" },
                activeBg: { $type: "color", $value: "#4346b8" },
              },
              secondary: {
                bg: { $type: "color", $value: "#1e1e28" },
                fg: { $type: "color", $value: "#e8e8f0" },
                border: { $type: "color", $value: "rgba(255,255,255,0.08)" },
                hoverBg: { $type: "color", $value: "#26262f" },
                activeBg: { $type: "color", $value: "#2c2c36" },
              },
              ghost: {
                bg: { $type: "color", $value: "transparent" },
                fg: { $type: "color", $value: "#e8e8f0" },
                border: { $type: "color", $value: "transparent" },
                hoverBg: { $type: "color", $value: "rgba(255,255,255,0.05)" },
                activeBg: { $type: "color", $value: "rgba(255,255,255,0.1)" },
              },
            },
          },
        },
        light: {
          semantic: {
            surface: {
              canvas: { $type: "color", $value: "#f5f4ff" },
              sunken: { $type: "color", $value: "#f5f4ff" },
              card: { $type: "color", $value: "#ffffff" },
              overlay: { $type: "color", $value: "#ffffff" },
            },
            text: {
              primary: { $type: "color", $value: "#1a1a2e" },
              muted: { $type: "color", $value: "#6b6b7e" },
              inverse: { $type: "color", $value: "#f8fafc" },
              link: { $type: "color", $value: "#6366f1" },
            },
            border: {
              subtle: { $type: "color", $value: "rgba(99,102,241,0.15)" },
              default: { $type: "color", $value: "rgba(99,102,241,0.15)" },
              strong: { $type: "color", $value: "#6366f1" },
            },
            focus: {
              ring: { $type: "color", $value: "rgba(99,102,241,0.15)" },
            },
            status: {
              success: {
                bg: { $type: "color", $value: "#dcfce7" },
                fg: { $type: "color", $value: "#166534" },
                border: { $type: "color", $value: "#22c55e" },
              },
              warning: {
                bg: { $type: "color", $value: "#fef3c7" },
                fg: { $type: "color", $value: "#92400e" },
                border: { $type: "color", $value: "#f59e0b" },
              },
              danger: {
                bg: { $type: "color", $value: "#fee2e2" },
                fg: { $type: "color", $value: "#991b1b" },
                border: { $type: "color", $value: "#ef4444" },
              },
            },
            interactive: {
              primary: {
                bg: { $type: "color", $value: "#6366f1" },
                fg: { $type: "color", $value: "#ffffff" },
                border: { $type: "color", $value: "#6366f1" },
                hoverBg: { $type: "color", $value: "#5356d4" },
                activeBg: { $type: "color", $value: "#4346b8" },
              },
              secondary: {
                bg: { $type: "color", $value: "#ffffff" },
                fg: { $type: "color", $value: "#1a1a2e" },
                border: { $type: "color", $value: "rgba(99,102,241,0.15)" },
                hoverBg: { $type: "color", $value: "#f5f4ff" },
                activeBg: { $type: "color", $value: "#ebe9fa" },
              },
              ghost: {
                bg: { $type: "color", $value: "transparent" },
                fg: { $type: "color", $value: "#1a1a2e" },
                border: { $type: "color", $value: "transparent" },
                hoverBg: { $type: "color", $value: "rgba(99,102,241,0.05)" },
                activeBg: { $type: "color", $value: "rgba(99,102,241,0.1)" },
              },
            },
          },
        },
      },
    },
  };
}

describe("validateThemeDocument", () => {
  it("accepts a minimal valid document", () => {
    const result = validateThemeDocument(minimalDoc());
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("accepts an alias reference in $value", () => {
    const doc = minimalDoc() as {
      tokens: {
        modes: {
          dark: { semantic: { text: { primary: { $value: string } } } };
        };
      };
    };
    doc.tokens.modes.dark.semantic.text.primary.$value =
      "{foundation.color.neutral.500}";
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(true);
  });

  it("rejects an unbalanced alias (missing close brace)", () => {
    const doc = minimalDoc() as {
      tokens: {
        modes: {
          dark: { semantic: { text: { primary: { $value: string } } } };
        };
      };
    };
    doc.tokens.modes.dark.semantic.text.primary.$value =
      "{foundation.color.neutral.500";
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("text.primary"))).toBe(
      true,
    );
  });

  it("rejects an empty alias path", () => {
    const doc = minimalDoc() as {
      tokens: {
        modes: {
          dark: { semantic: { text: { primary: { $value: string } } } };
        };
      };
    };
    doc.tokens.modes.dark.semantic.text.primary.$value = "{}";
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing required token", () => {
    const doc = minimalDoc() as {
      tokens: {
        modes: { dark: { semantic: { text: { primary?: unknown } } } };
      };
    };
    delete doc.tokens.modes.dark.semantic.text.primary;
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("text"))).toBe(true);
  });

  it("rejects an unknown key at strict level", () => {
    const doc = minimalDoc() as {
      tokens: { modes: { dark: { semantic: Record<string, unknown> } } };
    };
    (doc.tokens.modes.dark.semantic as Record<string, unknown>).bogus = {};
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
  });

  it("rejects a wrong leaf $type (color where dimension expected)", () => {
    const doc = minimalDoc() as {
      tokens: {
        foundation: { spacing: { "0": { $type: string; $value: unknown } } };
      };
    };
    doc.tokens.foundation.spacing["0"] = { $type: "color", $value: "#fff" };
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests — expect alias-syntax tests to FAIL**

Run: `npm run test:run -- src/themes/themeDocumentValidation.test.ts`
Expected: the "rejects an unbalanced alias" and "rejects an empty alias path" tests FAIL (validator currently accepts any string). Other tests PASS.

- [ ] **Step 3: Add the alias-syntax refinement**

Edit `src/themes/themeDocumentValidation.ts`. Above the `themeDocumentSchema` definition (after the individual `colorTokenSchema` etc. blocks), add this regex check helper and apply it to every leaf type whose `$value` is a string. The simplest place is right after `tokenLeafSchema` is built — add a top-level refinement to the document schema.

Find this near the bottom:

```ts
const themeDocumentSchema = z
  .object({
    $schema: z.string().optional(),
    ...
    tokens: z
      .object({
        foundation: foundationTokensSchema,
        modes: z
          .object({
            dark: modeGroupSchema,
            light: modeGroupSchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
```

Replace it with:

```ts
const ALIAS_RE = /^\{([\w.]+)\}$/;

function findAliasIssues(
  doc: unknown,
  prefix: string[] = [],
): ThemeValidationIssue[] {
  if (!doc || typeof doc !== "object") return [];
  const issues: ThemeValidationIssue[] = [];
  const record = doc as Record<string, unknown>;
  if (typeof record.$value === "string") {
    const v = record.$value;
    // Looks alias-like (has at least one brace) but doesn't match the strict pattern.
    if ((v.includes("{") || v.includes("}")) && !ALIAS_RE.test(v)) {
      issues.push({
        path: prefix.join(".") || "$",
        message: `Malformed alias reference: ${JSON.stringify(v)}`,
      });
    }
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === "$value" || key === "$type" || key === "$description") continue;
    issues.push(...findAliasIssues(value, [...prefix, key]));
  }
  return issues;
}

const themeDocumentSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    version: z.number().int().min(1),
    isActive: z.boolean(),
    createdAt: isoDateTimeSchema.optional(),
    updatedAt: isoDateTimeSchema.optional(),
    tokens: z
      .object({
        foundation: foundationTokensSchema,
        modes: z
          .object({
            dark: modeGroupSchema,
            light: modeGroupSchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
```

Then update `validateThemeDocument` to also surface alias-syntax issues:

```ts
export function validateThemeDocument(input: unknown): ThemeValidationResult {
  const normalized = normalizeTokenTypeCascade(input);
  const parsed = themeDocumentSchema.safeParse(normalized);
  if (!parsed.success) {
    const issues: ThemeValidationIssue[] = parsed.error.issues.map((issue) => ({
      path: issuePath(issue.path),
      message: issue.message,
    }));
    return { ok: false, issues };
  }

  const aliasIssues = findAliasIssues(parsed.data.tokens);
  if (aliasIssues.length > 0) {
    return { ok: false, issues: aliasIssues };
  }

  return { ok: true, data: parsed.data, issues: [] };
}
```

- [ ] **Step 4: Run the validator tests — expect all PASS**

Run: `npm run test:run -- src/themes/themeDocumentValidation.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/themeDocumentValidation.ts src/themes/themeDocumentValidation.test.ts
git commit -m "feat(theming): validate alias reference syntax in theme documents"
```

---

## Task 4: Resolver — write failing tests

**Files:**

- Create: `src/themes/resolver.test.ts`

This task only writes the tests. The resolver implementation lands in Task 5.

- [ ] **Step 1: Write `src/themes/resolver.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { resolveTheme, ThemeResolutionError } from "./resolver";
import type { ThemeDocument } from "./themeDocumentValidation";

// Minimal doc with placeholders for the leaf under test. We mutate one path per test.
function makeDoc(mutate: (doc: ThemeDocument) => void): ThemeDocument {
  const doc = JSON.parse(JSON.stringify(BASE_DOC)) as ThemeDocument;
  mutate(doc);
  return doc;
}

describe("resolveTheme — alias resolution", () => {
  it("resolves a direct alias to a foundation token", () => {
    const doc = makeDoc((d) => {
      d.tokens.modes.dark.semantic.text.primary = {
        $type: "color",
        $value: "{foundation.color.neutral.500}",
      };
    });
    const resolved = resolveTheme(doc, "dark");
    expect(resolved.semantic.text.primary).toBe("#6b7280");
  });

  it("resolves a chained alias (depth 2)", () => {
    const doc = makeDoc((d) => {
      // Force a chain by adding an alias-targeting-alias
      d.tokens.foundation.color.neutral["250"] = {
        $type: "color",
        $value: "{foundation.color.neutral.500}",
      };
      d.tokens.modes.dark.semantic.text.primary = {
        $type: "color",
        $value: "{foundation.color.neutral.250}",
      };
    });
    const resolved = resolveTheme(doc, "dark");
    expect(resolved.semantic.text.primary).toBe("#6b7280");
  });

  it("resolves alias chains up to depth 8", () => {
    const doc = makeDoc((d) => {
      const palette = d.tokens.foundation.color.neutral as Record<
        string,
        unknown
      >;
      // 7 hops: a → b → c → d → e → f → g → 500
      const letters = ["a", "b", "c", "d", "e", "f", "g"];
      letters.forEach((letter, idx) => {
        const next =
          idx === letters.length - 1
            ? "foundation.color.neutral.500"
            : `foundation.color.neutral.${letters[idx + 1]}`;
        palette[letter] = { $type: "color", $value: `{${next}}` };
      });
      d.tokens.modes.dark.semantic.text.primary = {
        $type: "color",
        $value: "{foundation.color.neutral.a}",
      };
    });
    const resolved = resolveTheme(doc, "dark");
    expect(resolved.semantic.text.primary).toBe("#6b7280");
  });

  it('throws ThemeResolutionError with reason="depth" for >8 hops', () => {
    const doc = makeDoc((d) => {
      const palette = d.tokens.foundation.color.neutral as Record<
        string,
        unknown
      >;
      const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i"]; // 9 hops
      letters.forEach((letter, idx) => {
        const next =
          idx === letters.length - 1
            ? "foundation.color.neutral.500"
            : `foundation.color.neutral.${letters[idx + 1]}`;
        palette[letter] = { $type: "color", $value: `{${next}}` };
      });
      d.tokens.modes.dark.semantic.text.primary = {
        $type: "color",
        $value: "{foundation.color.neutral.a}",
      };
    });
    expect(() => resolveTheme(doc, "dark")).toThrow(ThemeResolutionError);
    try {
      resolveTheme(doc, "dark");
    } catch (err) {
      expect(err).toBeInstanceOf(ThemeResolutionError);
      expect((err as ThemeResolutionError).reason).toBe("depth");
    }
  });

  it('throws ThemeResolutionError with reason="cycle" on a cyclic alias', () => {
    const doc = makeDoc((d) => {
      const palette = d.tokens.foundation.color.neutral as Record<
        string,
        unknown
      >;
      palette.a = { $type: "color", $value: "{foundation.color.neutral.b}" };
      palette.b = { $type: "color", $value: "{foundation.color.neutral.a}" };
      d.tokens.modes.dark.semantic.text.primary = {
        $type: "color",
        $value: "{foundation.color.neutral.a}",
      };
    });
    try {
      resolveTheme(doc, "dark");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ThemeResolutionError);
      expect((err as ThemeResolutionError).reason).toBe("cycle");
    }
  });

  it('throws ThemeResolutionError with reason="missing" for an unknown target', () => {
    const doc = makeDoc((d) => {
      d.tokens.modes.dark.semantic.text.primary = {
        $type: "color",
        $value: "{foundation.color.brand.999}",
      };
    });
    try {
      resolveTheme(doc, "dark");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ThemeResolutionError);
      expect((err as ThemeResolutionError).reason).toBe("missing");
    }
  });

  it('throws ThemeResolutionError with reason="cross-mode" for an alias targeting the other mode', () => {
    const doc = makeDoc((d) => {
      // dark.semantic refers to light's surface, which should be rejected
      d.tokens.modes.dark.semantic.text.primary = {
        $type: "color",
        $value: "{modes.light.semantic.surface.canvas}",
      };
    });
    try {
      resolveTheme(doc, "dark");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ThemeResolutionError);
      expect((err as ThemeResolutionError).reason).toBe("cross-mode");
    }
  });
});

describe("resolveTheme — mode handling", () => {
  it("produces structurally identical shapes for dark and light modes", () => {
    const dark = resolveTheme(BASE_DOC, "dark");
    const light = resolveTheme(BASE_DOC, "light");
    // Same key shape, different values.
    expect(Object.keys(dark.semantic).sort()).toEqual(
      Object.keys(light.semantic).sort(),
    );
    expect(dark.semantic.surface.canvas).not.toBe(
      light.semantic.surface.canvas,
    );
    expect(dark.meta.mode).toBe("dark");
    expect(light.meta.mode).toBe("light");
  });

  it("strips $type/$value wrappers and writes raw values into ResolvedTheme", () => {
    const resolved = resolveTheme(BASE_DOC, "dark");
    expect(typeof resolved.semantic.text.primary).toBe("string");
    expect(resolved.semantic.text.primary).not.toMatch(/\$value/);
    expect(typeof resolved.foundation.typography.lineHeight.normal).toBe(
      "number",
    );
  });
});

describe("resolveTheme — override layering", () => {
  it("applies a single override onto semantic tokens", () => {
    const resolved = resolveTheme(BASE_DOC, "dark", [
      {
        semantic: {
          text: { primary: { $type: "color", $value: "#ff00ff" } },
        },
      },
    ]);
    expect(resolved.semantic.text.primary).toBe("#ff00ff");
  });

  it("layers multiple overrides — later overrides win on conflict", () => {
    const resolved = resolveTheme(BASE_DOC, "dark", [
      {
        semantic: { text: { primary: { $type: "color", $value: "#aaaaaa" } } },
      },
      {
        semantic: { text: { primary: { $type: "color", $value: "#bbbbbb" } } },
      },
    ]);
    expect(resolved.semantic.text.primary).toBe("#bbbbbb");
  });

  it("does not blow away inherited values when override key is undefined", () => {
    const resolved = resolveTheme(BASE_DOC, "dark", [
      // Override is for components.toolbar only — should not nuke surface.
      {
        components: {
          toolbar: { background: { $type: "color", $value: "#123456" } },
        },
      },
    ]);
    expect(resolved.semantic.surface.canvas).toBeDefined();
    expect(resolved.components?.toolbar?.background).toBe("#123456");
  });
});

// BASE_DOC: a fully-specified ThemeDocument used as the starting point for tests.
// Defined at module scope so JSON.parse(JSON.stringify(...)) is cheap. This duplicates
// the fixture from themeDocumentValidation.test.ts intentionally — tests are isolated.
const BASE_DOC: ThemeDocument = {
  id: "fixture",
  name: "Fixture",
  version: 1,
  isActive: true,
  tokens: {
    foundation: {
      color: {
        brand: {
          "500": { $type: "color", $value: "#6366f1" },
          "600": { $type: "color", $value: "#5356d4" },
        },
        neutral: {
          "100": { $type: "color", $value: "#f3f4f6" },
          "500": { $type: "color", $value: "#6b7280" },
          "900": { $type: "color", $value: "#111827" },
        },
        success: { "500": { $type: "color", $value: "#22c55e" } },
        warning: { "500": { $type: "color", $value: "#f59e0b" } },
        danger: { "500": { $type: "color", $value: "#ef4444" } },
      },
      spacing: {
        "0": { $type: "dimension", $value: "0px" },
        "1": { $type: "dimension", $value: "4px" },
        "2": { $type: "dimension", $value: "8px" },
        "3": { $type: "dimension", $value: "12px" },
        "4": { $type: "dimension", $value: "16px" },
        "6": { $type: "dimension", $value: "24px" },
        "8": { $type: "dimension", $value: "32px" },
      },
      radius: {
        sm: { $type: "dimension", $value: "6px" },
        md: { $type: "dimension", $value: "10px" },
        lg: { $type: "dimension", $value: "14px" },
        full: { $type: "dimension", $value: "9999px" },
      },
      typography: {
        family: {
          base: { $type: "fontFamily", $value: "Inter, sans-serif" },
          mono: { $type: "fontFamily", $value: "monospace" },
        },
        size: {
          xs: { $type: "dimension", $value: "12px" },
          sm: { $type: "dimension", $value: "14px" },
          md: { $type: "dimension", $value: "16px" },
          lg: { $type: "dimension", $value: "18px" },
          xl: { $type: "dimension", $value: "20px" },
        },
        weight: {
          regular: { $type: "fontWeight", $value: 400 },
          medium: { $type: "fontWeight", $value: 500 },
          semibold: { $type: "fontWeight", $value: 600 },
          bold: { $type: "fontWeight", $value: 700 },
        },
        lineHeight: {
          tight: { $type: "number", $value: 1.2 },
          normal: { $type: "number", $value: 1.5 },
          relaxed: { $type: "number", $value: 1.75 },
        },
      },
    },
    modes: {
      dark: {
        semantic: {
          surface: {
            canvas: { $type: "color", $value: "#0a0a0f" },
            sunken: { $type: "color", $value: "#0a0a0f" },
            card: { $type: "color", $value: "#1e1e28" },
            overlay: { $type: "color", $value: "#1e1e28" },
          },
          text: {
            primary: { $type: "color", $value: "#e8e8f0" },
            muted: { $type: "color", $value: "#6c6c7e" },
            inverse: { $type: "color", $value: "#101828" },
            link: { $type: "color", $value: "#6366f1" },
          },
          border: {
            subtle: { $type: "color", $value: "rgba(255,255,255,0.08)" },
            default: { $type: "color", $value: "rgba(255,255,255,0.08)" },
            strong: { $type: "color", $value: "#6366f1" },
          },
          focus: { ring: { $type: "color", $value: "rgba(99,102,241,0.3)" } },
          status: {
            success: {
              bg: { $type: "color", $value: "#166534" },
              fg: { $type: "color", $value: "#dcfce7" },
              border: { $type: "color", $value: "#22c55e" },
            },
            warning: {
              bg: { $type: "color", $value: "#92400e" },
              fg: { $type: "color", $value: "#fef3c7" },
              border: { $type: "color", $value: "#f59e0b" },
            },
            danger: {
              bg: { $type: "color", $value: "#991b1b" },
              fg: { $type: "color", $value: "#fee2e2" },
              border: { $type: "color", $value: "#ef4444" },
            },
          },
          interactive: {
            primary: {
              bg: { $type: "color", $value: "#6366f1" },
              fg: { $type: "color", $value: "#ffffff" },
              border: { $type: "color", $value: "#6366f1" },
              hoverBg: { $type: "color", $value: "#5356d4" },
              activeBg: { $type: "color", $value: "#4346b8" },
            },
            secondary: {
              bg: { $type: "color", $value: "#1e1e28" },
              fg: { $type: "color", $value: "#e8e8f0" },
              border: { $type: "color", $value: "rgba(255,255,255,0.08)" },
              hoverBg: { $type: "color", $value: "#26262f" },
              activeBg: { $type: "color", $value: "#2c2c36" },
            },
            ghost: {
              bg: { $type: "color", $value: "transparent" },
              fg: { $type: "color", $value: "#e8e8f0" },
              border: { $type: "color", $value: "transparent" },
              hoverBg: { $type: "color", $value: "rgba(255,255,255,0.05)" },
              activeBg: { $type: "color", $value: "rgba(255,255,255,0.1)" },
            },
          },
        },
      },
      light: {
        semantic: {
          surface: {
            canvas: { $type: "color", $value: "#f5f4ff" },
            sunken: { $type: "color", $value: "#f5f4ff" },
            card: { $type: "color", $value: "#ffffff" },
            overlay: { $type: "color", $value: "#ffffff" },
          },
          text: {
            primary: { $type: "color", $value: "#1a1a2e" },
            muted: { $type: "color", $value: "#6b6b7e" },
            inverse: { $type: "color", $value: "#f8fafc" },
            link: { $type: "color", $value: "#6366f1" },
          },
          border: {
            subtle: { $type: "color", $value: "rgba(99,102,241,0.15)" },
            default: { $type: "color", $value: "rgba(99,102,241,0.15)" },
            strong: { $type: "color", $value: "#6366f1" },
          },
          focus: { ring: { $type: "color", $value: "rgba(99,102,241,0.15)" } },
          status: {
            success: {
              bg: { $type: "color", $value: "#dcfce7" },
              fg: { $type: "color", $value: "#166534" },
              border: { $type: "color", $value: "#22c55e" },
            },
            warning: {
              bg: { $type: "color", $value: "#fef3c7" },
              fg: { $type: "color", $value: "#92400e" },
              border: { $type: "color", $value: "#f59e0b" },
            },
            danger: {
              bg: { $type: "color", $value: "#fee2e2" },
              fg: { $type: "color", $value: "#991b1b" },
              border: { $type: "color", $value: "#ef4444" },
            },
          },
          interactive: {
            primary: {
              bg: { $type: "color", $value: "#6366f1" },
              fg: { $type: "color", $value: "#ffffff" },
              border: { $type: "color", $value: "#6366f1" },
              hoverBg: { $type: "color", $value: "#5356d4" },
              activeBg: { $type: "color", $value: "#4346b8" },
            },
            secondary: {
              bg: { $type: "color", $value: "#ffffff" },
              fg: { $type: "color", $value: "#1a1a2e" },
              border: { $type: "color", $value: "rgba(99,102,241,0.15)" },
              hoverBg: { $type: "color", $value: "#f5f4ff" },
              activeBg: { $type: "color", $value: "#ebe9fa" },
            },
            ghost: {
              bg: { $type: "color", $value: "transparent" },
              fg: { $type: "color", $value: "#1a1a2e" },
              border: { $type: "color", $value: "transparent" },
              hoverBg: { $type: "color", $value: "rgba(99,102,241,0.05)" },
              activeBg: { $type: "color", $value: "rgba(99,102,241,0.1)" },
            },
          },
        },
      },
    },
  },
};
```

- [ ] **Step 2: Run the tests — expect FAIL (resolver doesn't exist)**

Run: `npm run test:run -- src/themes/resolver.test.ts`
Expected: FAIL with "Cannot find module './resolver'" or similar.

- [ ] **Step 3: Commit (failing tests)**

```bash
git add src/themes/resolver.test.ts
git commit -m "test(theming): failing resolver test cases for aliases, modes, overrides"
```

---

## Task 5: Resolver — implementation

**Files:**

- Create: `src/themes/resolver.ts`

- [ ] **Step 1: Write the resolver**

Create `src/themes/resolver.ts`:

```ts
import type { ColorMode, ResolvedTheme, ThemeOverride } from "../types/theme";
import type { ThemeDocument } from "./themeDocumentValidation";

const ALIAS_RE = /^\{([\w.]+)\}$/;
const MAX_DEPTH = 8;

export class ThemeResolutionError extends Error {
  constructor(
    public readonly path: string,
    public readonly reason: "cycle" | "missing" | "depth" | "cross-mode",
    public readonly trace?: string[],
  ) {
    super(
      `Theme resolution failed at "${path}": ${reason}${trace ? ` (trace: ${trace.join(" → ")})` : ""}`,
    );
    this.name = "ThemeResolutionError";
  }
}

type Json = unknown;

function isPlainObject(v: unknown): v is Record<string, Json> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function getPath(root: Record<string, Json>, path: string[]): Json {
  let cur: Json = root;
  for (const seg of path) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function deepMerge<T extends Record<string, Json>>(
  target: T,
  source: Record<string, Json>,
): T {
  const out = { ...target } as Record<string, Json>;
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

interface ResolveContext {
  doc: ThemeDocument;
  mode: ColorMode;
  /** Mode block after override layering — used for in-mode alias targets. */
  modeBlock: Record<string, Json>;
}

function resolveAlias(
  expression: string,
  ctx: ResolveContext,
  trace: string[],
  reportingPath: string,
): Json {
  if (trace.length > MAX_DEPTH) {
    throw new ThemeResolutionError(reportingPath, "depth", trace);
  }

  const m = ALIAS_RE.exec(expression);
  if (!m) return expression; // not actually an alias — return as-is

  const targetPath = m[1].split(".");
  if (trace.includes(expression)) {
    throw new ThemeResolutionError(reportingPath, "cycle", [
      ...trace,
      expression,
    ]);
  }

  // Reject cross-mode references: `modes.<other>.…` is not allowed.
  if (
    targetPath[0] === "modes" &&
    targetPath[1] &&
    targetPath[1] !== ctx.mode
  ) {
    throw new ThemeResolutionError(reportingPath, "cross-mode", [
      ...trace,
      expression,
    ]);
  }

  let targetNode: Json;
  if (targetPath[0] === "foundation") {
    targetNode = getPath(
      ctx.doc.tokens.foundation as Record<string, Json>,
      targetPath.slice(1),
    );
  } else if (targetPath[0] === "modes") {
    targetNode = getPath(ctx.modeBlock, targetPath.slice(2));
  } else if (targetPath[0] === "semantic" || targetPath[0] === "components") {
    targetNode = getPath(ctx.modeBlock, targetPath);
  } else {
    targetNode = undefined;
  }

  if (targetNode === undefined) {
    throw new ThemeResolutionError(reportingPath, "missing", [
      ...trace,
      expression,
    ]);
  }

  // Strip leaf wrapper if present.
  if (isPlainObject(targetNode) && "$value" in targetNode) {
    const v = targetNode.$value;
    if (typeof v === "string" && ALIAS_RE.test(v)) {
      return resolveAlias(v, ctx, [...trace, expression], reportingPath);
    }
    return v;
  }

  return targetNode;
}

function unwrap(node: Json, ctx: ResolveContext, reportingPath: string): Json {
  if (!isPlainObject(node)) return node;
  if ("$value" in node) {
    const v = node.$value;
    if (typeof v === "string" && ALIAS_RE.test(v)) {
      return resolveAlias(v, ctx, [], reportingPath);
    }
    return v;
  }
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = unwrap(
      value,
      ctx,
      reportingPath ? `${reportingPath}.${key}` : key,
    );
  }
  return out;
}

export function resolveTheme(
  doc: ThemeDocument,
  mode: ColorMode,
  overrides?: ThemeOverride[],
): ResolvedTheme {
  const baseModeBlock = doc.tokens.modes[mode] as unknown as Record<
    string,
    Json
  >;

  let modeBlock = baseModeBlock;
  if (overrides && overrides.length > 0) {
    for (const override of overrides) {
      modeBlock = deepMerge(
        modeBlock,
        override as unknown as Record<string, Json>,
      );
    }
  }

  const ctx: ResolveContext = { doc, mode, modeBlock };

  const foundation = unwrap(
    doc.tokens.foundation,
    ctx,
    "foundation",
  ) as ResolvedTheme["foundation"];
  const semantic = unwrap(
    modeBlock.semantic,
    ctx,
    "semantic",
  ) as ResolvedTheme["semantic"];
  const components = modeBlock.components
    ? (unwrap(
        modeBlock.components,
        ctx,
        "components",
      ) as ResolvedTheme["components"])
    : undefined;

  return {
    foundation,
    semantic,
    components,
    meta: { id: doc.id, name: doc.name, mode },
  };
}
```

- [ ] **Step 2: Run the resolver tests — expect PASS**

Run: `npm run test:run -- src/themes/resolver.test.ts`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/themes/resolver.ts
git commit -m "feat(theming): resolveTheme with alias resolution and override layering"
```

---

## Task 6: Bundled defaults — author all 8 ThemeDocuments

**Files:**

- Create: `src/themes/defaults.ts`

The W3C documents reuse a shared foundation subtree (everything except `color.brand` and `typography.family.base`). We expose `DEFAULT_THEME_DOCUMENTS`, `THEME_PRESET_OPTIONS`, `getPresetById`, and `pickActiveDocument` from this module.

- [ ] **Step 1: Create the defaults file**

Create `src/themes/defaults.ts`:

```ts
import type { ThemeDocument } from "./themeDocumentValidation";

const SCHEMA_URL = "https://homeslate.dev/schemas/theme-document.schema.json";

const SHARED_SPACING = {
  "0": { $type: "dimension", $value: "0px" },
  "1": { $type: "dimension", $value: "4px" },
  "2": { $type: "dimension", $value: "8px" },
  "3": { $type: "dimension", $value: "12px" },
  "4": { $type: "dimension", $value: "16px" },
  "6": { $type: "dimension", $value: "24px" },
  "8": { $type: "dimension", $value: "32px" },
  "12": { $type: "dimension", $value: "48px" },
  "16": { $type: "dimension", $value: "64px" },
} as const;

const SHARED_RADIUS = {
  none: { $type: "dimension", $value: "0px" },
  sm: { $type: "dimension", $value: "6px" },
  md: { $type: "dimension", $value: "10px" },
  lg: { $type: "dimension", $value: "14px" },
  xl: { $type: "dimension", $value: "18px" },
  full: { $type: "dimension", $value: "9999px" },
} as const;

const SHARED_TYPOGRAPHY_REST = {
  size: {
    xs: { $type: "dimension", $value: "12px" },
    sm: { $type: "dimension", $value: "14px" },
    md: { $type: "dimension", $value: "16px" },
    lg: { $type: "dimension", $value: "18px" },
    xl: { $type: "dimension", $value: "20px" },
    "2xl": { $type: "dimension", $value: "24px" },
  },
  weight: {
    regular: { $type: "fontWeight", $value: 400 },
    medium: { $type: "fontWeight", $value: 500 },
    semibold: { $type: "fontWeight", $value: 600 },
    bold: { $type: "fontWeight", $value: 700 },
  },
  lineHeight: {
    tight: { $type: "number", $value: 1.2 },
    normal: { $type: "number", $value: 1.5 },
    relaxed: { $type: "number", $value: 1.75 },
  },
} as const;

const NEUTRAL_PALETTE = {
  "50": { $type: "color", $value: "#fafafa" },
  "100": { $type: "color", $value: "#f3f4f6" },
  "200": { $type: "color", $value: "#e5e7eb" },
  "300": { $type: "color", $value: "#d1d5db" },
  "400": { $type: "color", $value: "#9ca3af" },
  "500": { $type: "color", $value: "#6b7280" },
  "600": { $type: "color", $value: "#4b5563" },
  "700": { $type: "color", $value: "#374151" },
  "800": { $type: "color", $value: "#1f2937" },
  "900": { $type: "color", $value: "#111827" },
} as const;

const STATUS_COLORS = {
  success: {
    "500": { $type: "color", $value: "#22c55e" },
    "600": { $type: "color", $value: "#16a34a" },
  },
  warning: {
    "500": { $type: "color", $value: "#f59e0b" },
    "600": { $type: "color", $value: "#d97706" },
  },
  danger: {
    "500": { $type: "color", $value: "#ef4444" },
    "600": { $type: "color", $value: "#dc2626" },
  },
  info: {
    "500": { $type: "color", $value: "#0ea5e9" },
    "600": { $type: "color", $value: "#0284c7" },
  },
} as const;

interface ThemeSeed {
  id: string;
  name: string;
  brand: { "500": string; "600": string };
  fontFamily: string;
  dark: ModeSeed;
  light: ModeSeed;
}

interface ModeSeed {
  canvas: string;
  card: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  glow: string;
}

const SEEDS: ThemeSeed[] = [
  {
    id: "cosmos",
    name: "Cosmos",
    brand: { "500": "#6366f1", "600": "#a855f7" },
    fontFamily: "'Outfit', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)",
        "radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)",
        "radial-gradient(ellipse at 50% 50%, rgba(16, 185, 129, 0.05) 0%, transparent 50%)",
        "#0a0a0f",
      ].join(", "),
      card: "rgba(30, 30, 40, 0.6)",
      border: "rgba(255, 255, 255, 0.08)",
      textPrimary: "#e8e8f0",
      textMuted: "#6c6c7e",
      glow: "rgba(99, 102, 241, 0.3)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)",
        "radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)",
        "#f5f4ff",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.85)",
      border: "rgba(99, 102, 241, 0.15)",
      textPrimary: "#1a1a2e",
      textMuted: "#6b6b7e",
      glow: "rgba(99, 102, 241, 0.15)",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    brand: { "500": "#3b82f6", "600": "#60a5fa" },
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    dark: {
      canvas: "#080c14",
      card: "rgba(15, 20, 35, 0.85)",
      border: "rgba(255, 255, 255, 0.06)",
      textPrimary: "#e2e8f0",
      textMuted: "#64748b",
      glow: "rgba(59, 130, 246, 0.2)",
    },
    light: {
      canvas: "#eef3fb",
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(59, 130, 246, 0.15)",
      textPrimary: "#0f172a",
      textMuted: "#64748b",
      glow: "rgba(59, 130, 246, 0.1)",
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    brand: { "500": "#10b981", "600": "#34d399" },
    fontFamily: "'DM Sans', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 30% 70%, rgba(16, 185, 129, 0.15) 0%, transparent 60%)",
        "radial-gradient(ellipse at 70% 20%, rgba(52, 211, 153, 0.08) 0%, transparent 50%)",
        "#060f0d",
      ].join(", "),
      card: "rgba(16, 28, 25, 0.7)",
      border: "rgba(16, 185, 129, 0.15)",
      textPrimary: "#d1fae5",
      textMuted: "#6b7280",
      glow: "rgba(16, 185, 129, 0.25)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 30% 70%, rgba(16, 185, 129, 0.08) 0%, transparent 60%)",
        "#f0fdf8",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.85)",
      border: "rgba(16, 185, 129, 0.2)",
      textPrimary: "#064e3b",
      textMuted: "#6b7280",
      glow: "rgba(16, 185, 129, 0.12)",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    brand: { "500": "#f59e0b", "600": "#ef4444" },
    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 20% 80%, rgba(245, 158, 11, 0.15) 0%, transparent 60%)",
        "radial-gradient(ellipse at 75% 15%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)",
        "#100804",
      ].join(", "),
      card: "rgba(30, 18, 10, 0.7)",
      border: "rgba(245, 158, 11, 0.12)",
      textPrimary: "#fef3c7",
      textMuted: "#78716c",
      glow: "rgba(245, 158, 11, 0.25)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 20% 80%, rgba(245, 158, 11, 0.08) 0%, transparent 60%)",
        "radial-gradient(ellipse at 75% 15%, rgba(239, 68, 68, 0.05) 0%, transparent 50%)",
        "#fffbf0",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(245, 158, 11, 0.2)",
      textPrimary: "#431407",
      textMuted: "#78716c",
      glow: "rgba(245, 158, 11, 0.1)",
    },
  },
  {
    id: "neon",
    name: "Neon",
    brand: { "500": "#f0abfc", "600": "#67e8f9" },
    fontFamily: "'Sora', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 30% 40%, rgba(240, 171, 252, 0.1) 0%, transparent 50%)",
        "radial-gradient(ellipse at 70% 60%, rgba(103, 232, 249, 0.07) 0%, transparent 50%)",
        "#02020a",
      ].join(", "),
      card: "rgba(15, 8, 25, 0.85)",
      border: "rgba(240, 171, 252, 0.15)",
      textPrimary: "#fce7f3",
      textMuted: "#6b7280",
      glow: "rgba(240, 171, 252, 0.3)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 30% 40%, rgba(192, 38, 211, 0.06) 0%, transparent 50%)",
        "radial-gradient(ellipse at 70% 60%, rgba(6, 182, 212, 0.05) 0%, transparent 50%)",
        "#fdf4ff",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(192, 38, 211, 0.15)",
      textPrimary: "#3b0764",
      textMuted: "#6b7280",
      glow: "rgba(192, 38, 211, 0.1)",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    brand: { "500": "#06b6d4", "600": "#0ea5e9" },
    fontFamily: "'Nunito', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 40% 60%, rgba(6, 182, 212, 0.15) 0%, transparent 60%)",
        "radial-gradient(ellipse at 70% 20%, rgba(14, 165, 233, 0.1) 0%, transparent 50%)",
        "#020b14",
      ].join(", "),
      card: "rgba(10, 20, 40, 0.7)",
      border: "rgba(6, 182, 212, 0.15)",
      textPrimary: "#e0f2fe",
      textMuted: "#64748b",
      glow: "rgba(6, 182, 212, 0.25)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 40% 60%, rgba(6, 182, 212, 0.07) 0%, transparent 60%)",
        "#f0f9ff",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(6, 182, 212, 0.2)",
      textPrimary: "#0c4a6e",
      textMuted: "#64748b",
      glow: "rgba(6, 182, 212, 0.1)",
    },
  },
  {
    id: "forest",
    name: "Forest",
    brand: { "500": "#22c55e", "600": "#86efac" },
    fontFamily: "'DM Sans', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 30% 60%, rgba(34, 197, 94, 0.12) 0%, transparent 60%)",
        "radial-gradient(ellipse at 70% 20%, rgba(134, 239, 172, 0.07) 0%, transparent 50%)",
        "#030f06",
      ].join(", "),
      card: "rgba(8, 20, 12, 0.75)",
      border: "rgba(34, 197, 94, 0.12)",
      textPrimary: "#dcfce7",
      textMuted: "#6b7280",
      glow: "rgba(34, 197, 94, 0.2)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 30% 60%, rgba(34, 197, 94, 0.07) 0%, transparent 60%)",
        "#f0fdf4",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(34, 197, 94, 0.2)",
      textPrimary: "#14532d",
      textMuted: "#6b7280",
      glow: "rgba(34, 197, 94, 0.1)",
    },
  },
  {
    id: "paper",
    name: "Paper",
    brand: { "500": "#4338ca", "600": "#7c3aed" },
    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
    dark: {
      canvas: "#16161e",
      card: "rgba(30, 30, 42, 0.85)",
      border: "rgba(255, 255, 255, 0.08)",
      textPrimary: "#e8e8f0",
      textMuted: "#6b7280",
      glow: "rgba(124, 58, 237, 0.2)",
    },
    light: {
      canvas: "#f5f5f7",
      card: "rgba(255, 255, 255, 0.85)",
      border: "rgba(0, 0, 0, 0.08)",
      textPrimary: "#1a1b1e",
      textMuted: "#6b7280",
      glow: "rgba(67, 56, 202, 0.15)",
    },
  },
];

function color(value: string) {
  return { $type: "color" as const, $value: value };
}

function modeBlock(seed: ModeSeed, _isDark: boolean) {
  return {
    semantic: {
      surface: {
        canvas: color(seed.canvas),
        sunken: color(seed.canvas),
        card: color(seed.card),
        overlay: color(seed.card),
      },
      text: {
        primary: color(seed.textPrimary),
        muted: color(seed.textMuted),
        inverse: color(_isDark ? "#101828" : "#f8fafc"),
        // link uses an alias to brand.500 — exercises the resolver in defaults.
        link: color("{foundation.color.brand.500}"),
      },
      border: {
        subtle: color(seed.border),
        default: color(seed.border),
        // strong is an alias to brand.500.
        strong: color("{foundation.color.brand.500}"),
      },
      focus: {
        ring: color(seed.glow),
      },
      status: {
        success: {
          bg: color(_isDark ? "#166534" : "#dcfce7"),
          fg: color(_isDark ? "#dcfce7" : "#166534"),
          border: color("{foundation.color.success.500}"),
        },
        warning: {
          bg: color(_isDark ? "#92400e" : "#fef3c7"),
          fg: color(_isDark ? "#fef3c7" : "#92400e"),
          border: color("{foundation.color.warning.500}"),
        },
        danger: {
          bg: color(_isDark ? "#991b1b" : "#fee2e2"),
          fg: color(_isDark ? "#fee2e2" : "#991b1b"),
          border: color("{foundation.color.danger.500}"),
        },
      },
      interactive: {
        primary: {
          bg: color("{foundation.color.brand.500}"),
          fg: color("#ffffff"),
          border: color("{foundation.color.brand.500}"),
          hoverBg: color("{foundation.color.brand.600}"),
          activeBg: color("{foundation.color.brand.600}"),
        },
        secondary: {
          bg: color(seed.card),
          fg: color(seed.textPrimary),
          border: color(seed.border),
          hoverBg: color(seed.card),
          activeBg: color(seed.card),
        },
        ghost: {
          bg: color("transparent"),
          fg: color(seed.textPrimary),
          border: color("transparent"),
          hoverBg: color(seed.card),
          activeBg: color(seed.card),
        },
      },
    },
    components: {
      widget: {
        background: color(seed.card),
        borderColor: color(seed.border),
        borderWidth: { $type: "dimension" as const, $value: "1px" },
        radius: { $type: "dimension" as const, $value: "12px" },
        padding: { $type: "dimension" as const, $value: "12px" },
      },
      toolbar: {
        background: color(seed.card),
        text: color(seed.textPrimary),
        icon: color(seed.textMuted),
        divider: color(seed.border),
        height: { $type: "dimension" as const, $value: "56px" },
      },
      badge: {
        background: color("{foundation.color.brand.500}"),
        text: color("#ffffff"),
        radius: { $type: "dimension" as const, $value: "9999px" },
        paddingX: { $type: "dimension" as const, $value: "10px" },
        paddingY: { $type: "dimension" as const, $value: "4px" },
      },
      control: {
        height: { $type: "dimension" as const, $value: "36px" },
        radius: { $type: "dimension" as const, $value: "8px" },
        borderColor: color(seed.border),
        background: color(seed.card),
        text: color(seed.textPrimary),
        placeholder: color(seed.textMuted),
      },
    },
  };
}

function buildDocument(seed: ThemeSeed): ThemeDocument {
  return {
    $schema: SCHEMA_URL,
    id: `theme_${seed.id}`,
    name: seed.name,
    version: 1,
    isActive: false,
    tokens: {
      foundation: {
        color: {
          brand: {
            "500": color(seed.brand["500"]),
            "600": color(seed.brand["600"]),
          },
          neutral: NEUTRAL_PALETTE,
          success: STATUS_COLORS.success,
          warning: STATUS_COLORS.warning,
          danger: STATUS_COLORS.danger,
          info: STATUS_COLORS.info,
        },
        spacing: SHARED_SPACING,
        radius: SHARED_RADIUS,
        typography: {
          family: {
            base: { $type: "fontFamily", $value: seed.fontFamily },
            mono: {
              $type: "fontFamily",
              $value: "'Fira Code', 'SFMono-Regular', Menlo, monospace",
            },
          },
          size: SHARED_TYPOGRAPHY_REST.size,
          weight: SHARED_TYPOGRAPHY_REST.weight,
          lineHeight: SHARED_TYPOGRAPHY_REST.lineHeight,
        },
      },
      modes: {
        dark: modeBlock(seed.dark, true),
        light: modeBlock(seed.light, false),
      },
    },
  } as ThemeDocument;
}

export const DEFAULT_THEME_DOCUMENTS: ThemeDocument[] =
  SEEDS.map(buildDocument);

export const THEME_PRESET_OPTIONS = DEFAULT_THEME_DOCUMENTS.map((doc) => ({
  value: doc.id,
  label: doc.name,
}));

export function getPresetById(id: string): ThemeDocument {
  return (
    DEFAULT_THEME_DOCUMENTS.find((doc) => doc.id === id) ??
    DEFAULT_THEME_DOCUMENTS[0]
  );
}

/**
 * Pick the active theme document for a display, with a deterministic fallback chain.
 * - If `activeThemeId` matches an entry in `themes`, return it.
 * - Else if `themes` is non-empty, return `themes[0]`.
 * - Else return the first bundled default.
 */
export function pickActiveDocument(
  themes: ThemeDocument[],
  activeThemeId: string | null,
): ThemeDocument {
  if (activeThemeId) {
    const found = themes.find((t) => t.id === activeThemeId);
    if (found) return found;
  }
  return themes[0] ?? DEFAULT_THEME_DOCUMENTS[0];
}
```

- [ ] **Step 2: Verify the file builds**

Run: `npx tsc --noEmit`
Expected: PASS — no errors. (`presets.ts` and `themeDocumentPresets.ts` still exist; that's fine.)

- [ ] **Step 3: Commit**

```bash
git add src/themes/defaults.ts
git commit -m "feat(theming): bundle 8 default theme documents authored as W3C tokens"
```

---

## Task 7: Defaults — validation + resolution snapshot tests

**Files:**

- Create: `src/themes/defaults.test.ts`

This is the spec's test suite #1 (`resolveTheme` correctness, 16 snapshots) + the validator-acceptance check for each bundled default.

- [ ] **Step 1: Write the test**

Create `src/themes/defaults.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_THEME_DOCUMENTS } from "./defaults";
import { validateThemeDocument } from "./themeDocumentValidation";
import { resolveTheme } from "./resolver";

describe("DEFAULT_THEME_DOCUMENTS — validation", () => {
  for (const doc of DEFAULT_THEME_DOCUMENTS) {
    it(`validates: ${doc.name}`, () => {
      const result = validateThemeDocument(doc);
      if (!result.ok) {
        // Surface the first issue in the failure message — easier to debug than a JSON dump.
        throw new Error(
          `${doc.name} failed validation: ${JSON.stringify(result.issues, null, 2)}`,
        );
      }
      expect(result.ok).toBe(true);
    });
  }
});

describe("DEFAULT_THEME_DOCUMENTS — resolveTheme snapshots", () => {
  for (const doc of DEFAULT_THEME_DOCUMENTS) {
    for (const mode of ["dark", "light"] as const) {
      it(`resolves: ${doc.name} (${mode})`, () => {
        const resolved = resolveTheme(doc, mode);
        expect(resolved).toMatchSnapshot();
      });
    }
  }
});
```

- [ ] **Step 2: Run the tests; commit the generated snapshots**

Run: `npm run test:run -- src/themes/defaults.test.ts`
Expected: validation PASS for all 8 docs. Snapshot tests pass (writing new snapshots).

A new directory `src/themes/__snapshots__/defaults.test.ts.snap` will be created.

- [ ] **Step 3: Commit**

```bash
git add src/themes/defaults.test.ts src/themes/__snapshots__/
git commit -m "test(theming): validate and snapshot bundled theme document resolution"
```

---

## Task 8: Rewrite `themeToVars` for the `--token-*` namespace

**Files:**

- Modify: `src/themes/utils.ts`
- Create: `src/themes/utils.test.ts`

The new signature is `themeToVars(resolved: ResolvedTheme): Record<string, string>`. We keep `hexToRgb` and `getBackgroundStyle`. Mode is no longer a parameter — `ResolvedTheme.meta.mode` carries it.

- [ ] **Step 1: Write failing tests**

Create `src/themes/utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { themeToVars, hexToRgb } from "./utils";
import { resolveTheme } from "./resolver";
import { DEFAULT_THEME_DOCUMENTS } from "./defaults";

const cosmos = DEFAULT_THEME_DOCUMENTS.find((d) => d.id === "theme_cosmos")!;

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#6366f1")).toEqual({ r: 99, g: 102, b: 241 });
  });

  it("returns null for invalid input", () => {
    expect(hexToRgb("not-a-color")).toBeNull();
  });
});

describe("themeToVars — Cosmos dark snapshot", () => {
  it("produces the expected --token-* map", () => {
    const resolved = resolveTheme(cosmos, "dark");
    const vars = themeToVars(resolved);
    expect(vars).toMatchSnapshot();
  });
});

describe("themeToVars — naming convention assertions", () => {
  const resolved = resolveTheme(cosmos, "dark");
  const vars = themeToVars(resolved);

  it("emits foundation.color.brand.500 as --token-color-brand-500", () => {
    expect(vars["--token-color-brand-500"]).toBe("#6366f1");
  });

  it("emits typography.family.base as --token-font-base", () => {
    expect(vars["--token-font-base"]).toContain("Outfit");
  });

  it("emits typography.size.md as --token-font-size-md", () => {
    expect(vars["--token-font-size-md"]).toBe("16px");
  });

  it("emits typography.weight.bold as --token-font-weight-bold", () => {
    expect(vars["--token-font-weight-bold"]).toBe("700");
  });

  it("emits typography.lineHeight.normal as --token-line-height-normal", () => {
    expect(vars["--token-line-height-normal"]).toBe("1.5");
  });

  it("emits camelCase paths in kebab-case (interactive.primary.hoverBg → --token-interactive-primary-hover-bg)", () => {
    expect(vars["--token-interactive-primary-hover-bg"]).toBeDefined();
  });

  it("emits semantic.surface.canvas as --token-surface-canvas", () => {
    expect(vars["--token-surface-canvas"]).toContain("#0a0a0f");
  });

  it("emits the derived --token-color-brand-500-rgb", () => {
    expect(vars["--token-color-brand-500-rgb"]).toBe("99, 102, 241");
  });

  it("emits the derived --token-glow as a duplicate of --token-focus-ring", () => {
    expect(vars["--token-glow"]).toBeDefined();
    expect(vars["--token-glow"]).toBe(vars["--token-focus-ring"]);
  });

  it("does not emit any legacy --theme-* variables", () => {
    for (const key of Object.keys(vars)) {
      expect(key.startsWith("--token-")).toBe(true);
    }
  });
});

describe("themeToVars — optional groups omitted when not present", () => {
  it("does not emit shadow vars for a theme without foundation.shadow", () => {
    const resolved = resolveTheme(cosmos, "dark");
    const vars = themeToVars(resolved);
    const shadowKeys = Object.keys(vars).filter((k) =>
      k.startsWith("--token-shadow-"),
    );
    expect(shadowKeys).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run; expect FAIL (signature mismatch)**

Run: `npm run test:run -- src/themes/utils.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/themes/utils.ts`**

Replace the entire file with:

```ts
import type { CSSProperties } from "react";
import type { ResolvedTheme } from "../types/theme";

export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

interface BackgroundImageConfig {
  backgroundImage?: string;
  backgroundImageSize?: "cover" | "contain" | "tile";
  backgroundOverlayOpacity?: number;
}

/**
 * Returns inline background style when a background image is set on a view layout.
 * Layers a semi-transparent dark overlay on top of the image so text stays readable.
 */
export function getBackgroundStyle(
  config: BackgroundImageConfig,
): CSSProperties {
  if (!config.backgroundImage) return {};
  const opacity = config.backgroundOverlayOpacity ?? 0.5;
  const size =
    config.backgroundImageSize === "tile"
      ? "auto"
      : (config.backgroundImageSize ?? "cover");
  const repeat = config.backgroundImageSize === "tile" ? "repeat" : "no-repeat";
  return {
    background: `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity})), url(${config.backgroundImage}) center/${size} ${repeat}`,
  };
}

const KEBAB_RE = /([a-z0-9])([A-Z])/g;
function kebab(s: string): string {
  return s.replace(KEBAB_RE, "$1-$2").toLowerCase();
}

/**
 * Build a CSS variable name from a ResolvedTheme path. Encodes the spec's abbreviation rules:
 *  - typography.family.X        → font-X         (drops "family")
 *  - typography.size.X          → font-size-X
 *  - typography.weight.X        → font-weight-X
 *  - typography.lineHeight.X    → line-height-X  (drops "typography" entirely)
 *  - zIndex.X                   → z-X
 * Everything else is a mechanical kebab-case flatten with '-' separators.
 */
function varName(path: string[]): string {
  // Special-case typography subtree.
  if (path[0] === "foundation" && path[1] === "typography") {
    if (path[2] === "family") {
      const tail = path.slice(3); // e.g. ['base'], ['mono'], ['display']
      return `--token-font${tail.length ? `-${tail.map(kebab).join("-")}` : ""}`;
    }
    if (path[2] === "lineHeight") {
      return `--token-line-height-${path.slice(3).map(kebab).join("-")}`;
    }
    // size, weight → font-size, font-weight
    return `--token-font-${kebab(path[2])}-${path.slice(3).map(kebab).join("-")}`;
  }
  // zIndex.X → z-X
  if (path[0] === "foundation" && path[1] === "zIndex") {
    return `--token-z-${path.slice(2).map(kebab).join("-")}`;
  }
  // Drop the leading "foundation"/"semantic"/"components" parent — vars omit it.
  const stripped =
    path[0] === "foundation" ||
    path[0] === "semantic" ||
    path[0] === "components"
      ? path.slice(1)
      : path;
  return `--token-${stripped.map(kebab).join("-")}`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function walk(
  node: unknown,
  path: string[],
  out: Record<string, string>,
): void {
  if (node === undefined || node === null) return;
  if (isObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      walk(value, [...path, key], out);
    }
    return;
  }
  // Skip `meta` subtree — it's runtime metadata, not a CSS var.
  if (path[0] === "meta") return;
  out[varName(path)] = String(node);
}

/** Convert a ResolvedTheme into a `--token-*` CSS variable map. */
export function themeToVars(resolved: ResolvedTheme): Record<string, string> {
  const out: Record<string, string> = {};
  walk(resolved.foundation, ["foundation"], out);
  walk(resolved.semantic, ["semantic"], out);
  if (resolved.components) walk(resolved.components, ["components"], out);

  // Derived vars.
  const brand500 = resolved.foundation.color.brand["500"];
  if (brand500 && brand500.startsWith("#")) {
    const rgb = hexToRgb(brand500);
    if (rgb)
      out["--token-color-brand-500-rgb"] = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  }
  out["--token-glow"] = resolved.semantic.focus.ring;

  return out;
}
```

- [ ] **Step 4: Run the tests — expect PASS**

Run: `npm run test:run -- src/themes/utils.test.ts`
Expected: tests pass; the snapshot file is created on first run.

- [ ] **Step 5: Commit**

```bash
git add src/themes/utils.ts src/themes/utils.test.ts src/themes/__snapshots__/utils.test.ts.snap
git commit -m "feat(theming): rewrite themeToVars for --token-* namespace"
```

---

## Task 9: `pickActiveDocument` test suite

**Files:**

- Create: `src/themes/index.test.ts`

`pickActiveDocument` is implemented in Task 6. This task adds the dedicated test suite called out in the spec.

- [ ] **Step 1: Write the test**

Create `src/themes/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickActiveDocument, DEFAULT_THEME_DOCUMENTS } from "./defaults";

const A = { ...DEFAULT_THEME_DOCUMENTS[0], id: "doc_a" };
const B = { ...DEFAULT_THEME_DOCUMENTS[1], id: "doc_b" };

describe("pickActiveDocument fallback chain", () => {
  it("returns the bundled default when themes is empty and activeId is null", () => {
    const picked = pickActiveDocument([], null);
    expect(picked).toBe(DEFAULT_THEME_DOCUMENTS[0]);
  });

  it("returns themes[0] when activeId does not match any entry", () => {
    const picked = pickActiveDocument([A, B], "doc_missing");
    expect(picked.id).toBe("doc_a");
  });

  it("returns the matching entry when activeId is found", () => {
    const picked = pickActiveDocument([A, B], "doc_b");
    expect(picked.id).toBe("doc_b");
  });

  it("returns themes[0] when activeId is null but themes is non-empty", () => {
    const picked = pickActiveDocument([A, B], null);
    expect(picked.id).toBe("doc_a");
  });
});
```

- [ ] **Step 2: Run the tests — expect PASS**

Run: `npm run test:run -- src/themes/index.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/themes/index.test.ts
git commit -m "test(theming): pickActiveDocument fallback chain"
```

---

## Task 10: Mantine bridge

**Files:**

- Create: `src/themes/mantineBridge.ts`

- [ ] **Step 1: Implement the bridge**

Create `src/themes/mantineBridge.ts`:

```ts
import type { MantineColorsTuple, MantineThemeOverride } from "@mantine/core";
import type { ResolvedTheme } from "../types/theme";

/**
 * Build a 10-shade Mantine tuple from an arbitrary palette object.
 *
 * Mantine wants [shade-0 (lightest) .. shade-9 (darkest)]. If the palette already
 * contains 50/100/.../900 keys, use them in that order. Otherwise, fan out from
 * the closest available '500' (or first defined entry) by repeating it.
 */
function spreadHexShadesFrom(
  palette: Record<string, string>,
): MantineColorsTuple {
  const ordered = [
    "50",
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
  ];
  const shades = ordered
    .map((k) => palette[k])
    .filter((v): v is string => typeof v === "string");
  if (shades.length === 10) return shades as unknown as MantineColorsTuple;

  const seed = palette["500"] ?? Object.values(palette)[0] ?? "#6366f1";
  return Array.from(
    { length: 10 },
    (_, i) => palette[ordered[i]] ?? seed,
  ) as unknown as MantineColorsTuple;
}

export function mantineThemeFromResolved(
  resolved: ResolvedTheme,
): MantineThemeOverride {
  return {
    primaryColor: "brand",
    colors: {
      brand: spreadHexShadesFrom(resolved.foundation.color.brand),
    },
    fontFamily: resolved.foundation.typography.family.base,
    fontFamilyMonospace: resolved.foundation.typography.family.mono,
    radius: {
      sm: resolved.foundation.radius.sm,
      md: resolved.foundation.radius.md,
      lg: resolved.foundation.radius.lg,
    },
    headings: {
      fontFamily:
        resolved.foundation.typography.family.display ??
        resolved.foundation.typography.family.base,
    },
  };
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/themes/mantineBridge.ts
git commit -m "feat(theming): mantineThemeFromResolved bridge"
```

---

## Task 11: Update `src/themes/index.ts` exports

**Files:**

- Modify: `src/themes/index.ts`

The new module is the canonical export surface. Old `presets.ts`-driven exports go away here even though `presets.ts` still exists on disk (deleted in Task 20).

- [ ] **Step 1: Replace the file contents**

Overwrite `src/themes/index.ts` with:

```ts
export {
  DEFAULT_THEME_DOCUMENTS,
  THEME_PRESET_OPTIONS,
  getPresetById,
  pickActiveDocument,
} from "./defaults";
export { themeToVars, hexToRgb, getBackgroundStyle } from "./utils";
export { resolveTheme, ThemeResolutionError } from "./resolver";
export { mantineThemeFromResolved } from "./mantineBridge";
export {
  validateThemeDocument,
  isThemeDocumentCandidate,
} from "./themeDocumentValidation";
export type { ThemeDocument } from "./themeDocumentValidation";

import { DEFAULT_THEME_DOCUMENTS } from "./defaults";
/** First bundled theme — used as the boot fallback before any display has been loaded. */
export const defaultThemeDocument = DEFAULT_THEME_DOCUMENTS[0];
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: type errors will appear in callsites still importing `defaultTheme`/`PRESET_THEMES`/`FONT_OPTIONS`. That is expected — those are fixed in Tasks 18, 19, 20. Don't fix them yet.

- [ ] **Step 3: Commit**

```bash
git add src/themes/index.ts
git commit -m "refactor(theming): rewire themes/index.ts to the new modules"
```

---

## Task 12: Update the dashboard store

Rename `themeDocuments → themes`, `activeThemeDocumentId → activeThemeId`. Drop `theme`. Bump persist version 4 → 5. Add new actions. The legacy `setDisplayTheme` action goes away.

**Files:**

- Modify: `src/store/dashboardStore.ts`

- [ ] **Step 1: Update imports**

At the top of the file, replace:

```ts
import type { ColorMode, DisplayTheme } from "../types/theme";
import type { ThemeDocument } from "../themes/themeDocumentValidation";
```

with:

```ts
import type { ColorMode, ThemeDocument } from "../types/theme";
```

- [ ] **Step 2: Update the `Display` and `RemoteDisplay` interfaces**

Replace the `Display` interface's theme-related fields:

```ts
// before
theme?: DisplayTheme;
themeDocuments?: ThemeDocument[];
activeThemeDocumentId?: string | null;

// after
themes: ThemeDocument[];
activeThemeId: string | null;
```

Replace the corresponding fields in `RemoteDisplay.config`:

```ts
// before
theme?: DisplayTheme;
themeDocuments?: ThemeDocument[];
activeThemeDocumentId?: string | null;

// after
themes?: ThemeDocument[];
activeThemeId?: string | null;
```

- [ ] **Step 3: Replace the action surface**

In the `DashboardState` interface, remove this line:

```ts
setDisplayTheme: (displayId: string, theme: DisplayTheme) => void;
```

Add these in its place:

```ts
setThemes: (displayId: string, themes: ThemeDocument[], activeThemeId: string | null) => void;
setActiveTheme: (displayId: string, themeId: string) => void;
saveTheme: (displayId: string, theme: ThemeDocument) => void;       // upsert by id
deleteTheme: (displayId: string, themeId: string) => void;
duplicateTheme: (displayId: string, themeId: string) => void;
```

- [ ] **Step 4: Update `setDisplays` merge logic**

Inside `setDisplays`, find the existing block that merges theme fields. Replace:

```ts
theme: config.theme ?? existing?.theme,
themeDocuments: config.themeDocuments ?? existing?.themeDocuments,
activeThemeDocumentId: config.activeThemeDocumentId ?? existing?.activeThemeDocumentId ?? null,
```

with:

```ts
themes: config.themes ?? existing?.themes ?? [],
activeThemeId: config.activeThemeId ?? existing?.activeThemeId ?? null,
```

Also make sure the default-config object created when `remote.config` is null gets `themes: []` and `activeThemeId: null`:

```ts
const config = remote.config ?? {
  layouts: [createDefaultLayout()],
  activeLayoutId: null,
  rotationEnabled: false,
  rotationIntervalMs: 30000,
  themes: [],
  activeThemeId: null,
};
```

- [ ] **Step 5: Replace `setDisplayTheme` with the new actions**

Remove the existing `setDisplayTheme` implementation. In the same area of the file, add:

```ts
setThemes: (displayId, themes, activeThemeId) => {
  set((state) => ({
    displays: updateDisplay(state.displays, displayId, (d) => ({
      ...d,
      themes,
      activeThemeId,
    })),
  }));
},

setActiveTheme: (displayId, themeId) => {
  set((state) => ({
    displays: updateDisplay(state.displays, displayId, (d) => ({
      ...d,
      activeThemeId: themeId,
      themes: d.themes.map((t) => ({ ...t, isActive: t.id === themeId })),
    })),
  }));
},

saveTheme: (displayId, theme) => {
  set((state) => ({
    displays: updateDisplay(state.displays, displayId, (d) => {
      const idx = d.themes.findIndex((t) => t.id === theme.id);
      const themes = idx >= 0
        ? d.themes.map((t, i) => (i === idx ? theme : t))
        : [...d.themes, theme];
      return { ...d, themes };
    }),
  }));
},

deleteTheme: (displayId, themeId) => {
  set((state) => ({
    displays: updateDisplay(state.displays, displayId, (d) => {
      const themes = d.themes.filter((t) => t.id !== themeId);
      const activeThemeId = d.activeThemeId === themeId ? null : d.activeThemeId;
      return { ...d, themes, activeThemeId };
    }),
  }));
},

duplicateTheme: (displayId, themeId) => {
  set((state) => ({
    displays: updateDisplay(state.displays, displayId, (d) => {
      const source = d.themes.find((t) => t.id === themeId);
      if (!source) return d;
      const clone: ThemeDocument = {
        ...source,
        id: `${source.id}_copy_${Date.now()}`,
        name: `${source.name} (Copy)`,
        isActive: false,
      };
      return { ...d, themes: [...d.themes, clone] };
    }),
  }));
},
```

- [ ] **Step 6: Initialize the new fields in `addDisplay` and `createDefaultDisplay`**

In `createDefaultDisplay`, add `themes: []` and `activeThemeId: null` to the returned object. Same for `addDisplay`'s `newDisplay` literal.

- [ ] **Step 7: Bump persist version 4 → 5 and migrate**

Replace the `version: 4` and `migrate` block at the bottom:

```ts
version: 5,
partialize: (state) => ({
  displays: state.displays,
  selectedDisplayId: state.selectedDisplayId,
  selectedViewId: state.selectedViewId,
}),
migrate: (persistedState: unknown, version: number) => {
  if (version === 5) return persistedState;

  // Any pre-5 state: drop legacy theme fields. We don't translate
  // legacy DisplayTheme objects — themes start empty and the viewer
  // falls back to the bundled default until the user picks/creates one.
  const stripDisplay = (d: Record<string, unknown>): Record<string, unknown> => {
    const { theme: _theme, themeDocuments: _td, activeThemeDocumentId: _atd, ...rest } = d;
    return { ...rest, themes: [], activeThemeId: null };
  };

  if (version === 4 || version === 3) {
    const state = persistedState as { displays?: Array<Record<string, unknown>> };
    return { ...state, displays: (state.displays ?? []).map(stripDisplay) };
  }

  if (version === 0 || version === 1) {
    // Migrate from old flat shape.
    const old = persistedState as {
      layouts?: DashboardLayout[];
      activeLayoutId?: string | null;
      rotationEnabled?: boolean;
      rotationIntervalMs?: number;
    };
    const layouts = old.layouts ?? [createDefaultLayout()];
    const activeLayoutId = old.activeLayoutId ?? layouts[0]?.id ?? null;
    const migratedDisplay = createDefaultDisplay();
    migratedDisplay.layouts = layouts;
    migratedDisplay.activeLayoutId = activeLayoutId;
    migratedDisplay.rotationEnabled = old.rotationEnabled ?? false;
    migratedDisplay.rotationIntervalMs = old.rotationIntervalMs ?? 30000;
    return {
      displays: [migratedDisplay],
      selectedDisplayId: null,
      selectedViewId: null,
    };
  }

  return persistedState;
},
```

The discarded underscored bindings (`_theme`, `_td`, `_atd`) silence eslint while making it explicit that those legacy fields are intentionally dropped.

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: errors will surface at callsites of `setDisplayTheme` and at any code reading `display.theme` or `display.themeDocuments`. Those are addressed in Tasks 13, 14, 18, 19. Don't fix them yet.

- [ ] **Step 9: Commit**

```bash
git add src/store/dashboardStore.ts
git commit -m "refactor(theming): rename store fields to themes/activeThemeId, bump persist v5"
```

---

## Task 13: Update API request type

**Files:**

- Modify: `src/types/api.ts`

- [ ] **Step 1: Replace the theme fields**

In `src/types/api.ts`, change the imports:

```ts
import type { ColorMode, ThemeDocument } from "./theme";
```

Remove `DisplayTheme` from the import line — it stays in `theme.ts` for now, but `api.ts` doesn't need it anymore.

Replace the `ConfigUpsertRequest`'s theme fields:

```ts
// before
theme?: DisplayTheme | Record<string, unknown>;
themeDocuments?: ThemeDocument[];
activeThemeDocumentId?: string | null;

// after
themes?: ThemeDocument[];
activeThemeId?: string | null;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: still has errors from netlify config + store, but `src/types/api.ts` itself compiles.

- [ ] **Step 3: Commit**

```bash
git add src/types/api.ts
git commit -m "refactor(theming): rename ConfigUpsertRequest theme fields"
```

---

## Task 14: Update the netlify config function

**Files:**

- Modify: `netlify/functions/config.ts`

Server-side: validate every theme in the new `themes[]` array and reject unknown `activeThemeId`. On read-cleanup, strip legacy fields silently.

- [ ] **Step 1: Replace the body schema**

In `netlify/functions/config.ts`, replace `ConfigBodySchema` with:

```ts
const ConfigBodySchema = z
  .object({
    layouts: z.array(z.unknown()),
    activeLayoutId: z.string().nullable(),
    rotationEnabled: z.boolean(),
    rotationIntervalMs: z.number().int().positive(),
    themes: z.array(z.unknown()).optional(),
    activeThemeId: z.string().nullable().optional(),
    colorMode: z.enum(["light", "dark"]).optional(),
    stickyNotesEnabled: z.boolean().optional(),
    holidayEffectsEnabled: z.boolean().optional(),
    holidayPreviewId: z
      .enum([
        "new-years-day",
        "valentines-day",
        "st-patricks-day",
        "independence-day",
        "halloween",
        "thanksgiving",
        "christmas",
        "new-years-eve",
      ])
      .optional(),
  })
  .passthrough();
```

- [ ] **Step 2: Replace the validation block**

Inside the PUT handler, find and replace the entire block that previously validated `theme` and `themeDocuments` (the three `if (parsedConfig.data.theme...) { ... }` and `if (parsedConfig.data.themeDocuments...) { ... }` blocks plus the `activeThemeDocumentId` check) with:

```ts
if (parsedConfig.data.themes !== undefined) {
  const issues = parsedConfig.data.themes.flatMap((document, index) => {
    const validation = validateThemeDocument(document);
    if (validation.ok) return [];
    return validation.issues.map((issue) => ({
      path: `themes[${index}].${issue.path}`,
      message: issue.message,
    }));
  });
  if (issues.length > 0) {
    return errorResponse(400, "Invalid themes payload", AUTH_JSON_HEADERS, {
      details: { issues },
    });
  }
}

if (
  parsedConfig.data.themes !== undefined &&
  parsedConfig.data.activeThemeId !== undefined &&
  parsedConfig.data.activeThemeId !== null
) {
  const ids = parsedConfig.data.themes
    .map((document) =>
      typeof document === "object" && document && "id" in document
        ? (document as { id?: unknown }).id
        : undefined,
    )
    .filter((id): id is string => typeof id === "string");
  if (!ids.includes(parsedConfig.data.activeThemeId)) {
    return errorResponse(
      400,
      "activeThemeId must exist in themes",
      AUTH_JSON_HEADERS,
    );
  }
}
```

- [ ] **Step 3: Update the cast for the upsert payload**

Replace:

```ts
const config: ConfigUpsertRequest = {
  ...parsedConfig.data,
  themeDocuments: parsedConfig.data
    .themeDocuments as ConfigUpsertRequest["themeDocuments"],
};
```

with:

```ts
const config: ConfigUpsertRequest = {
  ...parsedConfig.data,
  themes: parsedConfig.data.themes as ConfigUpsertRequest["themes"],
};
```

- [ ] **Step 4: Drop the `isThemeDocumentCandidate` import (now unused)**

Change:

```ts
import {
  isThemeDocumentCandidate,
  validateThemeDocument,
} from "../../src/themes/themeDocumentValidation";
```

to:

```ts
import { validateThemeDocument } from "../../src/themes/themeDocumentValidation";
```

- [ ] **Step 5: Strip legacy fields on read**

Find the function in this same file that fetches and returns config (the read path). If `displayConfigs.config` contains any of `theme`, `themeDocuments`, or `activeThemeDocumentId`, omit them from the response. If the read path lives in another file (search for `displayConfigs` usage with `select`), apply the same change there. Run `npm run build` after to confirm types line up.

The minimum change here: when the config object is returned to the client, do this transform once before sending:

```ts
function stripLegacyThemeFields(
  config: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!config) return config;
  const {
    theme: _t,
    themeDocuments: _td,
    activeThemeDocumentId: _atd,
    ...rest
  } = config;
  return rest;
}
```

(Apply at the response-shaping point. If the read endpoint already trusts the jsonb verbatim and doesn't reshape, leave a TODO comment and let it land on save instead — the save path now writes the new fields only, so legacy fields decay over time.)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS for `netlify/functions/config.ts`. Errors remain in store/components — fine.

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/config.ts
git commit -m "refactor(theming): API accepts themes[]/activeThemeId, validates each document"
```

---

## Task 15: Replace `:root` block in `App.css`

**Files:**

- Modify: `src/App.css`

- [ ] **Step 1: Edit `App.css`**

Replace this block (lines ~3-25 in `src/App.css`):

```css
:root {
  /* Legacy aliases */
  --gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-accent: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  --glass-bg: rgba(30, 30, 40, 0.6);
  --glass-border: rgba(255, 255, 255, 0.08);

  /* Theme defaults (Cosmos) — overridden by ThemeProvider inline styles */
  --theme-bg:
    radial-gradient(
      ellipse at 20% 20%,
      rgba(99, 102, 241, 0.15) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 80% 80%,
      rgba(168, 85, 247, 0.1) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 50% 50%,
      rgba(16, 185, 129, 0.05) 0%,
      transparent 50%
    ),
    #0a0a0f;
  --theme-accent: #6366f1;
  --theme-accent-rgb: 99, 102, 241;
  --theme-accent-secondary: #a855f7;
  --theme-surface-bg: rgba(30, 30, 40, 0.6);
  --theme-surface-border: rgba(255, 255, 255, 0.08);
  --theme-text: #e8e8f0;
  --theme-text-muted: #6c6c7e;
  --theme-glow: rgba(99, 102, 241, 0.3);
  --theme-font-family: "Outfit", "Inter", sans-serif;
}
```

with:

```css
:root {
  /* Theme tokens are emitted on the viewer root by ThemeProvider — see :root[data-theme-fallback] for the boot/non-viewer fallback. */
}

:root[data-theme-fallback] {
  --token-surface-canvas: #0a0a0f;
  --token-surface-card: rgba(30, 30, 40, 0.6);
  --token-border-default: rgba(255, 255, 255, 0.08);
  --token-text-primary: #e8e8f0;
  --token-text-muted: #6c6c7e;
  --token-color-brand-500: #6366f1;
  --token-color-brand-500-rgb: 99, 102, 241;
  --token-color-brand-600: #a855f7;
  --token-focus-ring: rgba(99, 102, 241, 0.3);
  --token-glow: rgba(99, 102, 241, 0.3);
  --token-font-base: "Outfit", "Inter", sans-serif;
}
```

- [ ] **Step 2: Update the body background rule**

Find:

```css
body {
  background: var(--theme-bg, #0a0a0f);
  ...
}
```

Change to:

```css
body {
  background: var(--token-surface-canvas, #0a0a0f);
  ...
}
```

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "refactor(theming): replace --theme-* defaults in App.css with --token-* fallback set"
```

---

## Task 16: Set `data-theme-fallback` in `main.tsx`

**Files:**

- Modify: `src/main.tsx`

- [ ] **Step 1: Add the attribute set on boot**

Edit `src/main.tsx`. Above the `createRoot(document.getElementById('root')!)` line, add:

```ts
// Boot fallback: render auth/pair pages with a minimal --token-* set until ThemeProvider
// runs and stamps the full namespace on the viewer root. See App.css :root[data-theme-fallback].
document.documentElement.dataset.themeFallback = "";
```

- [ ] **Step 2: Commit**

```bash
git add src/main.tsx
git commit -m "refactor(theming): set data-theme-fallback for boot before ThemeProvider mounts"
```

---

## Task 17: Sweep 13 `*.module.css` files

Apply the spec's substitution table to every `*.module.css` and `*.css` file that references the legacy namespace (excluding `App.css`, already done). Files affected:

```
src/components/Dashboard.module.css
src/components/DisplayViewer.module.css
src/components/ThemeDocumentManager.module.css
src/components/WidgetPanel.module.css
src/components/WidgetWrapper.module.css
src/pages/ViewEditorPage.module.css
src/widgets/ClockWidget.module.css
src/widgets/GoogleCalendarDayWidget.module.css
src/widgets/GoogleCalendarMonthWidget.module.css
src/widgets/GoogleCalendarWidget.module.css
src/widgets/GooglePhotoCollageWidget.module.css
src/widgets/TodoWidget.module.css
```

(That's 12. The 13th file is `src/App.css`, handled in Task 15.)

**Substitution table:**

```
--theme-bg                 →  --token-surface-canvas
--theme-accent             →  --token-color-brand-500
--theme-accent-rgb         →  --token-color-brand-500-rgb
--theme-accent-secondary   →  --token-color-brand-600
--theme-surface-bg         →  --token-surface-card
--theme-surface-border     →  --token-border-default
--theme-text               →  --token-text-primary
--theme-text-muted         →  --token-text-muted
--theme-glow               →  --token-focus-ring
--theme-font-family        →  --token-font-base

--gradient-primary         →  delete (unused)
--gradient-accent          →  delete (unused)
--glass-bg                 →  delete (unused)
--glass-border             →  delete (unused)
```

- [ ] **Step 1: Run a sed sweep across every CSS file**

```bash
files=(
  src/components/Dashboard.module.css
  src/components/DisplayViewer.module.css
  src/components/ThemeDocumentManager.module.css
  src/components/WidgetPanel.module.css
  src/components/WidgetWrapper.module.css
  src/pages/ViewEditorPage.module.css
  src/widgets/ClockWidget.module.css
  src/widgets/GoogleCalendarDayWidget.module.css
  src/widgets/GoogleCalendarMonthWidget.module.css
  src/widgets/GoogleCalendarWidget.module.css
  src/widgets/GooglePhotoCollageWidget.module.css
  src/widgets/TodoWidget.module.css
)

for f in "${files[@]}"; do
  # Order matters — replace the longer names first so prefix-collision doesn't bite.
  sed -i '' \
    -e 's/--theme-accent-secondary/--token-color-brand-600/g' \
    -e 's/--theme-accent-rgb/--token-color-brand-500-rgb/g' \
    -e 's/--theme-accent/--token-color-brand-500/g' \
    -e 's/--theme-surface-bg/--token-surface-card/g' \
    -e 's/--theme-surface-border/--token-border-default/g' \
    -e 's/--theme-text-muted/--token-text-muted/g' \
    -e 's/--theme-text/--token-text-primary/g' \
    -e 's/--theme-glow/--token-focus-ring/g' \
    -e 's/--theme-font-family/--token-font-base/g' \
    -e 's/--theme-bg/--token-surface-canvas/g' \
    "$f"
done
```

The order is critical: `--theme-accent-secondary` and `--theme-accent-rgb` must be replaced before `--theme-accent`, otherwise the prefix-only substitution turns them into `--token-color-brand-500-secondary` and `--token-color-brand-500-rgb-rgb`.

- [ ] **Step 2: Verify no `--theme-*` references remain anywhere in `src/`**

Run: `grep -r --include='*.css' -- '--theme-' src/` — expect no output.
Run: `grep -r --include='*.tsx' --include='*.ts' -- '--theme-' src/` — expect no output (other than possibly comments; address those manually).

- [ ] **Step 3: Spot-check `rgba(var(--token-color-brand-500-rgb), 0.3)` patterns**

Run: `grep -rn 'rgba(var(--token-color-brand-500-rgb)' src/`
Expected: matches exist where the original used `rgba(var(--theme-accent-rgb), …)`. They should look correct as-is.

- [ ] **Step 4: Remove unused `--gradient-*` / `--glass-*` references**

Run: `grep -rn -- '--gradient-\|--glass-' src/`
For each match, replace with a hardcoded fallback or delete the entire rule. The legacy `:root` block in `App.css` was the only definer; with that gone, these vars are dead anywhere they appear. Most frequently they're set as `background: var(--gradient-primary)` — those rules can be deleted entirely (they were never visually load-bearing per the spec's "delete (unused)" notation).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: TS errors persist (callsites still reference legacy types) but CSS compiles.

- [ ] **Step 6: Commit**

```bash
git add src/components/*.module.css src/widgets/*.module.css src/pages/*.module.css
git commit -m "refactor(theming): sweep --theme-* references onto the --token-* namespace"
```

---

## Task 18: Update `ThemeContext` and the `DisplayViewer` integration

**Files:**

- Modify: `src/contexts/ThemeContext.tsx`
- Modify: `src/components/DisplayViewer.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Rewrite `ThemeContext`**

Overwrite `src/contexts/ThemeContext.tsx`:

```tsx
import { createContext, useContext, useMemo, useState, useEffect } from "react";
import type { ColorMode, ResolvedTheme, ThemeDocument } from "../types/theme";
import {
  defaultThemeDocument,
  pickActiveDocument,
  resolveTheme,
  themeToVars,
} from "../themes";
import { useDashboardStore } from "../store/dashboardStore";
import { getBackgroundStyle } from "../themes/utils";

interface ThemeContextValue {
  document: ThemeDocument;
  resolved: ResolvedTheme;
  vars: Record<string, string>;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
}

const initialResolved = resolveTheme(defaultThemeDocument, "dark");

const ThemeContext = createContext<ThemeContextValue>({
  document: defaultThemeDocument,
  resolved: initialResolved,
  vars: themeToVars(initialResolved),
  colorMode: "dark",
  setColorMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { displays, selectedDisplayId } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const document = pickActiveDocument(
    display?.themes ?? [],
    display?.activeThemeId ?? null,
  );

  // Mode: explicit per-display override > 'dark' default.
  const storedMode = display?.colorMode ?? "dark";
  const [colorMode, setColorMode] = useState<ColorMode>(storedMode);
  useEffect(() => {
    setColorMode(storedMode);
  }, [storedMode]);

  const resolved = useMemo(
    () => resolveTheme(document, colorMode),
    [document, colorMode],
  );
  const vars = useMemo(() => themeToVars(resolved), [resolved]);

  return (
    <ThemeContext.Provider
      value={{ document, resolved, vars, colorMode, setColorMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { themeToVars, getBackgroundStyle };
```

- [ ] **Step 2: Update `DisplayViewer.tsx`**

Replace the `DisplayConfig` `theme?: DisplayTheme` field — `DisplayViewer` now reads themes through props that come from the polled config payload. The simplest minimal change: switch the type and the resolution.

Find:

```ts
import type { ColorMode, DisplayTheme } from "../types/theme";
```

Change to:

```ts
import type { ColorMode } from "../types/theme";
import type { ThemeDocument } from "../themes";
import { resolveTheme, themeToVars, pickActiveDocument } from "../themes";
```

Find:

```ts
import { themeToVars } from "../themes/utils";
```

Delete that line — `themeToVars` is now imported above.

In `DisplayConfig`, change:

```ts
theme?: DisplayTheme;
```

to:

```ts
themes?: ThemeDocument[];
activeThemeId?: string | null;
```

Find this block near the bottom:

```ts
const effectiveColorMode: ColorMode =
  localColorMode ??
  config?.colorMode ??
  (config?.theme?.isDark === false ? "light" : "dark");
const themeVars = config?.theme
  ? themeToVars(config.theme, effectiveColorMode)
  : {};
```

Replace with:

```ts
const effectiveColorMode: ColorMode =
  localColorMode ?? config?.colorMode ?? "dark";
const activeDoc = config
  ? pickActiveDocument(config.themes ?? [], config.activeThemeId ?? null)
  : null;
const themeVars = activeDoc
  ? themeToVars(resolveTheme(activeDoc, effectiveColorMode))
  : {};
```

- [ ] **Step 3: Update `App.tsx`**

Find:

```ts
function useCurrentDisplayColorScheme(): "light" | "dark" {
  const { selectedDisplayId, displays } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  if (display?.colorMode) return display.colorMode;
  return display?.theme?.isDark === false ? "light" : "dark";
}
```

Replace with:

```ts
function useCurrentDisplayColorScheme(): "light" | "dark" {
  const { selectedDisplayId, displays } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  return display?.colorMode ?? "dark";
}
```

Then bridge the Mantine theme through the resolved theme. Replace the static `mantineTheme = createTheme({...})` near the top of `App.tsx` with a hook in the `App` component that derives Mantine theme from the active resolved theme:

```tsx
import {
  mantineThemeFromResolved,
  pickActiveDocument,
  resolveTheme,
} from "./themes";
import { defaultThemeDocument } from "./themes";

function useMantineTheme() {
  const { selectedDisplayId, displays } = useDashboardStore();
  const colorMode = useCurrentDisplayColorScheme();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const doc =
    pickActiveDocument(display?.themes ?? [], display?.activeThemeId ?? null) ??
    defaultThemeDocument;
  return mantineThemeFromResolved(resolveTheme(doc, colorMode));
}

function App() {
  const colorScheme = useCurrentDisplayColorScheme();
  const mantineTheme = useMantineTheme();

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={colorScheme}>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <AppInner />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </MantineProvider>
  );
}
```

Delete the old `const mantineTheme = createTheme({…})` block at the top of the file.

Also delete the `import { MantineProvider, createTheme, ... }` line's `createTheme` reference — it's no longer used. The replacement import: `import { MantineProvider, ActionIcon, Tooltip, Loader, Center } from '@mantine/core';`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — except errors in `ThemePicker.tsx` (handled in Task 19) and `ThemeDocumentManager.tsx` (kept; its type errors should now be limited to old store fields, fixed below).

If `ThemeDocumentManager.tsx` errors due to `display.themeDocuments` etc., update those references in-place to `display.themes` / `display.activeThemeId` and use the new actions (`setThemes`, `setActiveTheme`, etc.). The component's behavior shouldn't change beyond the field rename.

- [ ] **Step 5: Run all tests**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/contexts/ThemeContext.tsx src/components/DisplayViewer.tsx src/App.tsx src/components/ThemeDocumentManager.tsx
git commit -m "refactor(theming): wire ThemeContext, DisplayViewer, App.tsx onto the new pipeline"
```

---

## Task 19: Replace `ThemePicker` with a minimal preset-picker

The full Theme Studio comes in M3. M1 ships a tiny picker that just lets the user pick one of the 8 bundled defaults to copy into the display's `themes[]` and activate.

**Files:**

- Modify: `src/components/ThemePicker.tsx`
- Modify: `src/components/ThemePicker.module.css` (only if needed — most existing styles can stay)

- [ ] **Step 1: Replace the entire `ThemePicker.tsx`**

Overwrite with:

```tsx
import { useMemo } from "react";
import { Stack, Group, Text, Select } from "@mantine/core";
import { IconPalette } from "@tabler/icons-react";
import { DEFAULT_THEME_DOCUMENTS, THEME_PRESET_OPTIONS } from "../themes";
import type { ThemeDocument } from "../types/theme";
import classes from "./ThemePicker.module.css";

interface ThemePickerProps {
  themes: ThemeDocument[];
  activeThemeId: string | null;
  onChange: (themes: ThemeDocument[], activeThemeId: string | null) => void;
}

export function ThemePicker({
  themes,
  activeThemeId,
  onChange,
}: ThemePickerProps) {
  const activeId =
    activeThemeId ?? themes[0]?.id ?? DEFAULT_THEME_DOCUMENTS[0].id;

  const options = useMemo(() => THEME_PRESET_OPTIONS, []);

  const handleSelect = (value: string | null) => {
    if (!value) return;
    const preset = DEFAULT_THEME_DOCUMENTS.find((d) => d.id === value);
    if (!preset) return;
    // Upsert the chosen preset into the display's themes[] and activate it.
    const existing = themes.find((t) => t.id === preset.id);
    const nextThemes = existing
      ? themes.map((t) => ({ ...t, isActive: t.id === preset.id }))
      : [
          ...themes.map((t) => ({ ...t, isActive: false })),
          { ...preset, isActive: true },
        ];
    onChange(nextThemes, preset.id);
  };

  return (
    <Stack gap="md" className={classes.root}>
      <Group gap="xs">
        <IconPalette size={16} />
        <Text fw={600}>Theme</Text>
      </Group>
      <Select
        label="Active theme"
        placeholder="Choose a theme"
        data={options}
        value={activeId}
        onChange={handleSelect}
        searchable
      />
      <Text size="xs" c="dimmed">
        The full theme editor is coming in a later release. For now you can pick
        from the bundled presets.
      </Text>
    </Stack>
  );
}
```

- [ ] **Step 2: Update every callsite of `ThemePicker`**

Run: `grep -rn 'ThemePicker' src/ --include='*.tsx'` to find callsites.

The component is currently passed `value` (a `DisplayTheme`) and `onChange` (called with a `DisplayTheme`). Each callsite needs to switch to passing `themes` + `activeThemeId` and consuming the new onChange shape.

For each callsite (likely `DisplayDetailPage.tsx` or similar):

Replace something like:

```tsx
<ThemePicker
  value={display.theme}
  onChange={(theme) => setDisplayTheme(display.id, theme)}
/>
```

with:

```tsx
<ThemePicker
  themes={display.themes}
  activeThemeId={display.activeThemeId}
  onChange={(themes, activeThemeId) =>
    setThemes(display.id, themes, activeThemeId)
  }
/>
```

Also import `setThemes` from the store hook instead of `setDisplayTheme`.

- [ ] **Step 3: Type-check + run tests**

Run: `npx tsc --noEmit && npm run test:run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ThemePicker.tsx src/components/ThemePicker.module.css src/pages
git commit -m "refactor(theming): replace ThemePicker with minimal preset selector for M1"
```

---

## Task 20: Delete legacy code

Now safe to delete: `DisplayTheme`/`ThemeModeColors` types, the legacy preset module, the helper that lifted legacy presets to documents, and the unused preview-vars helper.

**Files:**

- Delete: `src/themes/presets.ts`
- Delete: `src/themes/themeDocumentPresets.ts`
- Delete: `src/themes/themeDocumentPreview.ts`
- Modify: `src/types/theme.ts` (remove `DisplayTheme`, `ThemeModeColors`)
- Modify: `src/themes/__smoke__.test.ts` (delete — no longer needed)

- [ ] **Step 1: Search for any remaining references**

Run: `grep -rn 'DisplayTheme\|ThemeModeColors\|themeDocumentToPreviewVars\|createThemeDocumentFromPreset\|PRESET_THEMES\|FONT_OPTIONS\|defaultTheme[^D]' src/ netlify/ --include='*.ts' --include='*.tsx'`

Each match must be either:

- Inside a file that is about to be deleted (presets.ts, themeDocumentPresets.ts, themeDocumentPreview.ts), or
- Updated/removed in this task.

The most likely stragglers are `defaultTheme` (renamed to `defaultThemeDocument`) and `FONT_OPTIONS` (no replacement — Theme Studio in M3 reintroduces a font catalog). For each `FONT_OPTIONS` callsite that's not in a deleted file, hardcode the font list inline as a temporary measure or comment-out the dropdown — the picker UI in M1 doesn't expose font choice, so this should be a small footprint.

- [ ] **Step 2: Delete `src/types/theme.ts`'s legacy exports**

Open `src/types/theme.ts`. Delete the original `ThemeModeColors` interface and `DisplayTheme` interface. Keep only: `ColorMode`, the `import type { ThemeDocument }`, the `export type { ThemeDocument }`, the `ResolvedTheme` interface (and its `StateTriplet`/`InteractiveTriplet` helpers), and `ThemeOverride`.

- [ ] **Step 3: Delete files**

```bash
rm src/themes/presets.ts
rm src/themes/themeDocumentPresets.ts
rm src/themes/themeDocumentPreview.ts
rm src/themes/__smoke__.test.ts
```

- [ ] **Step 4: Type-check + run tests + build**

Run: `npx tsc --noEmit && npm run test:run && npm run build`
Expected: all pass.

If any errors remain, they will be specific stragglers — fix them by updating the offending file (e.g., remove an unused `import type { DisplayTheme } from ...`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(theming): delete DisplayTheme and the legacy preset modules"
```

---

## Task 21: Build + manual QA gate

**Files:**

- None (verification only).

- [ ] **Step 1: Confirm full build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Confirm tests**

Run: `npm run test:run`
Expected: every suite green. Snapshots stable.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (or no new violations beyond pre-existing baseline).

- [ ] **Step 4: Manual QA — boot the dev server**

Run: `npm run dev`
Open the app in a browser. Walk through:

1. Auth/pair page renders (the `:root[data-theme-fallback]` set provides minimal styling).
2. Sign in. Display list page renders.
3. Open a display. Pick each of the 8 presets via `ThemePicker`. Confirm:
   - Background changes per preset.
   - Brand-colored accents (buttons, links, focus rings) update.
   - Widget surfaces (cards, toolbars) update.
4. Toggle the dark/light mode button on the viewer. Confirm:
   - All surfaces flip.
   - Text remains readable.
5. Open the `ThemeDocumentManager` (the JSON-and-preview UI). Edit a saved theme's JSON manually, save. Confirm preview matches viewer.
6. Deliberately break a saved theme (introduce an alias to `{foundation.color.brand.999}` which doesn't exist) via the JSON editor. Save attempt should be rejected by the validator. If the broken theme somehow gets activated (e.g. via direct DB edit during testing), the app should not crash silently — when implementing M2 we'll add the dedicated broken-theme screen, but for M1 the viewer can render the bundled default fallback.
7. Refresh the page hard. Confirm zustand-persisted state reloads correctly (persist v5 dropped any pre-5 theme state — display starts with `themes: []` and falls back to bundled default; user re-picks).

- [ ] **Step 5: Final commit (if any QA fixes are needed)**

If you found and fixed issues during manual QA, commit them with a message like `fix(theming): manual QA fixes for M1`. Otherwise nothing to commit.

- [ ] **Step 6: Wrap-up — declare M1 done**

M1's spec exit criteria:

- ✓ Every active theme value comes from the new token model.
- ✓ No legacy theme field access remains in app code.

The plan for M2 ("Runtime integration across app — per-widget token coverage audit") will be authored separately, as a new file under `docs/superpowers/plans/`.

---

## Test inventory (spec mapping)

Each spec test suite is implemented somewhere in the plan above:

| Spec test suite                                                                      | Implemented in  |
| ------------------------------------------------------------------------------------ | --------------- |
| 1. `resolveTheme` correctness — 8 presets × 2 modes = 16 snapshots                   | Task 7          |
| 2. Alias resolution (direct, chained, depth, cycle, missing, cross-mode)             | Task 4          |
| 3. Mode handling (dark/light produce identical shapes, mode-specific values)         | Task 4          |
| 4. Override layering (single, layered, undefined-key non-blowaway)                   | Task 4          |
| 5. Validator (accept defaults; reject missing, unknown, malformed alias, wrong type) | Task 3 + Task 7 |
| 6. `themeToVars` output (snapshot + naming convention assertions)                    | Task 8          |
| 7. `pickActiveDocument` fallback chain                                               | Task 9          |
