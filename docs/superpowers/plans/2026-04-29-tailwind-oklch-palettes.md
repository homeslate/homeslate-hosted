# Tailwind OKLCH Palettes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tailwind 4 OKLCH base palettes as first-class foundation color tokens and direct theme editor swatches.

**Architecture:** A new shared palette module owns Tailwind palette names, shade steps, OKLCH values, token conversion, and swatch flattening. Default theme documents include those token groups under `tokens.foundation.color`, validation/types accept the expanded foundation color model, and the quick editor imports swatches from the shared source.

**Tech Stack:** React 19, TypeScript, Mantine `ColorInput`, Zod validation, Vitest.

---

### Task 1: Shared Tailwind Palette Data

**Files:**
- Create: `src/themes/tailwindPalette.ts`
- Test: `src/themes/tailwindPalette.test.ts`

- [ ] **Step 1: Write tests for palette shape and helpers**

Add tests that assert representative OKLCH values, all expected shade keys, token conversion, and swatch flattening.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm run test:run -- src/themes/tailwindPalette.test.ts`

Expected: FAIL because `tailwindPalette.ts` does not exist yet.

- [ ] **Step 3: Implement palette data and helpers**

Create `TAILWIND_COLOR_PALETTES`, `TAILWIND_COLOR_SWATCHES`, and `tailwindPaletteToTokenGroup()` in `src/themes/tailwindPalette.ts`.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm run test:run -- src/themes/tailwindPalette.test.ts`

Expected: PASS.

### Task 2: Theme Documents, Types, And Validation

**Files:**
- Modify: `src/themes/defaults.ts`
- Modify: `src/types/theme.ts`
- Modify: `src/themes/themeDocumentValidation.ts`
- Test: `src/themes/defaults.test.ts`
- Test: `src/themes/themeDocumentValidation.test.ts`

- [ ] **Step 1: Write tests for default documents and validation**

Assert default themes include representative paths such as `foundation.color.red.500` with OKLCH values and validation accepts the expanded foundation color groups.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm run test:run -- src/themes/defaults.test.ts src/themes/themeDocumentValidation.test.ts`

Expected: FAIL until defaults and schema are updated.

- [ ] **Step 3: Include Tailwind palette groups in default theme documents**

Spread `tailwindPaletteToTokenGroup()` into `tokens.foundation.color`, preserving existing `brand`, `success`, `warning`, `danger`, and `info` groups.

- [ ] **Step 4: Update type and schema assumptions**

Allow named Tailwind color groups in `ResolvedTheme["foundation"]["color"]` and validation.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `npm run test:run -- src/themes/defaults.test.ts src/themes/themeDocumentValidation.test.ts`

Expected: PASS.

### Task 3: Editor Swatches And Reference Options

**Files:**
- Modify: `src/components/ThemeDocumentManager.tsx`
- Test: `src/themes/themeEditorModel.test.ts`

- [ ] **Step 1: Write tests for reference options**

Assert `buildColorReferenceOptions()` includes `{foundation.color.red.500}` and an OKLCH label.

- [ ] **Step 2: Run focused editor model tests and verify they fail**

Run: `npm run test:run -- src/themes/themeEditorModel.test.ts`

Expected: FAIL until default documents include Tailwind tokens.

- [ ] **Step 3: Use shared Tailwind swatches in `ColorInput`**

Import `TAILWIND_COLOR_SWATCHES` and replace the hardcoded `swatches` array.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm run test:run -- src/themes/themeEditorModel.test.ts src/themes/tailwindPalette.test.ts`

Expected: PASS.

### Task 4: Final Verification

**Files:**
- Verify: changed files only

- [ ] **Step 1: Run lints for edited files**

Use Cursor diagnostics for edited files and fix introduced errors.

- [ ] **Step 2: Run full focused test set**

Run: `npm run test:run -- src/themes/tailwindPalette.test.ts src/themes/defaults.test.ts src/themes/themeDocumentValidation.test.ts src/themes/themeEditorModel.test.ts`

Expected: PASS.
