# Theming Overhaul Roadmap

Simple execution plan focused on making theming world class for a single-user setup.

## Working Rules

- No backward-compatibility work.
- No dual schema or "v2" naming.
- Build for current app behavior first, then optimize.
- Finish one milestone before starting the next.

## Milestone 1: Theme Foundation and Token Model

Goal: replace the current basic theme shape with a complete token system.

### Tasks

- [ ] Redefine `DisplayTheme` to support:
  - foundation tokens (palette, typography, spacing, radius, shadow)
  - semantic tokens (surface, text, borders, states)
  - component tokens (widget shell, toolbar, badges, controls)
  - mode blocks (`dark`, `light`)
- [ ] Implement a single theme resolver:
  - input: theme + active color mode
  - output: fully resolved theme object with fallbacks
- [ ] Expand CSS variable generation to include all new tokens.
- [ ] Remove old one-off theme fields once all consumers are updated.
- [ ] Add unit tests for resolver and token fallback behavior.

### Exit Criteria

- Every active theme value comes from the new token model.
- No legacy theme field access remains in app code.

### Implementation Checklist (File-by-file)

Use this sequence exactly to avoid rework.

#### Step 1: Define the new theme contract

- [ ] Update `src/types/theme.ts`
  - [ ] Replace current flat fields with structured tokens:
    - [ ] `foundation` (palette, typography, spacing, radius, shadow)
    - [ ] `semantic` (background/surface/text/border/status/focus)
    - [ ] `components` (widget, toolbar, indicators, badges)
    - [ ] `modes.dark` and `modes.light`
  - [ ] Keep `ColorMode` as `dark | light`.
  - [ ] Add helper types for deep partial overrides (used later by overrides).

#### Step 2: Rebuild preset themes on the new schema

- [ ] Update `src/themes/presets.ts`
  - [ ] Convert all presets to the new nested token shape.
  - [ ] Ensure every preset has both `dark` and `light` mode blocks.
  - [ ] Keep `FONT_OPTIONS` aligned to `foundation.typography`.

#### Step 3: Build resolver + variable mapper

- [ ] Update `src/themes/utils.ts`
  - [ ] Add `resolveTheme(theme, mode)` that outputs one resolved object.
  - [ ] Add internal merge utilities for mode fallback behavior.
  - [ ] Replace old `themeToVars` logic with mapping from resolved tokens.
  - [ ] Expand CSS variable output to cover foundation, semantic, and component tokens.
  - [ ] Keep `hexToRgb` only if still needed by new token map.

#### Step 4: Wire default exports

- [ ] Update `src/themes/index.ts`
  - [ ] Ensure exports point to new theme types/helpers.
  - [ ] Keep `defaultTheme` pointing at a valid preset in new format.

#### Step 5: Update context shape for resolved theme access

- [ ] Update `src/contexts/ThemeContext.tsx`
  - [ ] Expose both raw theme and resolved theme (mode-aware).
  - [ ] Ensure mode selection still uses display `colorMode` override.
  - [ ] Export resolver helpers from one place for reuse.

#### Step 6: Update store typing to new theme structure

- [ ] Update `src/store/dashboardStore.ts`
  - [ ] Ensure `Display.theme` uses the new `DisplayTheme` interface.
  - [ ] Verify `setDisplays` and `setDisplayTheme` compile with new schema.

#### Step 7: Update API typing to new theme shape

- [ ] Update `src/types/api.ts`
  - [ ] Ensure `ConfigUpsertRequest.theme` references new theme type.
  - [ ] Remove temporary permissive typing once compile is green.

#### Step 8: Cut over all old field usages

- [ ] Search and remove old references:
  - [ ] `theme.background`
  - [ ] `theme.surfaceBg`
  - [ ] `theme.surfaceBorder`
  - [ ] `theme.textPrimary`
  - [ ] `theme.textMuted`
  - [ ] `theme.glowColor`
  - [ ] `theme.isDark`
- [ ] Replace with resolved token access or new mapped CSS variables.

#### Step 9: Add tests for theme resolution

- [ ] Add `src/themes/utils.test.ts` (or colocated test file)
  - [ ] Resolves dark and light modes correctly.
  - [ ] Fallback behavior works when tokens are omitted.
  - [ ] CSS variable map contains required keys.
  - [ ] Resolver output is stable for identical inputs.

#### Step 10: Milestone 1 validation pass

- [ ] Run typecheck/build and fix all errors.
- [ ] Manual check in app:
  - [ ] preset switch works
  - [ ] dark/light switch works
  - [ ] no obvious missing colors/text in viewer
  - [ ] no obvious missing colors/text in editor
- [ ] Confirm no legacy theme keys remain in codebase.

## Milestone 2: Runtime Integration Across App

Goal: apply the new theme tokens consistently in viewer and editor UI.

### Tasks

- [ ] Update `ThemeContext` to expose resolved theme data cleanly.
- [ ] Update `DisplayViewer` to apply the full token variable map.
- [ ] Update `WidgetWrapper` and shared layout styles to use semantic/component tokens.
- [ ] Replace hardcoded color/background values in key components with tokens.
- [ ] Add a quick "token coverage" checklist for every widget.

### Exit Criteria

- Core shell and all widgets render from token variables only.
- Switching themes or mode updates the full UI without visual mismatch.

## Milestone 3: Theme Studio (Editor UX)

Goal: replace basic customization with a practical theme studio.

### Tasks

- [ ] Redesign `ThemePicker` into sections:
  - Presets
  - Colors
  - Typography
  - Surfaces and effects
  - Advanced tokens
- [ ] Add instant preview while editing values.
- [ ] Add reset controls:
  - reset section
  - reset entire theme
- [ ] Add clone preset -> custom theme flow.
- [ ] Add theme rename and local save flow.

### Exit Criteria

- Full theme editing can be done from UI with no code edits.
- Creating and tweaking a custom theme is fast and obvious.

## Milestone 4: Scoped Overrides and Fine Control

Goal: support theme control at display, view, and widget levels.

### Tasks

- [ ] Add optional per-view theme override.
- [ ] Add optional per-widget style override (subset of safe tokens).
- [ ] Implement override resolution order:
  - display base
  - view override
  - widget override
- [ ] Add override controls in relevant editors.
- [ ] Add clear "inherit vs override" toggles and reset actions.

### Exit Criteria

- You can theme specific views/widgets without breaking global consistency.
- Inheritance behavior is predictable and transparent in UI.

## Milestone 5: Accessibility and Theme Quality Tools

Goal: keep themes readable and polished by default.

### Tasks

- [ ] Add contrast checker for primary text/surface combinations.
- [ ] Show warnings for problematic token combinations in editor.
- [ ] Add one-click "auto-fix contrast" suggestions for common issues.
- [ ] Add high-contrast preset themes.
- [ ] Add visual QA checklist for theme polish (hover, focus, disabled states).

### Exit Criteria

- Bad contrast is surfaced immediately during editing.
- Presets and custom themes stay readable in real usage.

## Milestone 6: Automation and Portability

Goal: make themes dynamic and easy to move/share.

### Tasks

- [ ] Add scheduled mode/theme switching (time-of-day rules).
- [ ] Add theme import/export as JSON.
- [ ] Add validation for imported theme payloads.
- [ ] Add duplicate/delete theme management actions.
- [ ] Add "quick apply" workflow for trying multiple themes rapidly.

### Exit Criteria

- Themes can be scheduled, exported, imported, and managed cleanly.
- Testing and switching between themes is fast.

## Suggested Execution Order (Task Batches)

1. Milestone 1 (all tasks)
2. Milestone 2 (all tasks)
3. Milestone 3 first three tasks, then remaining two
4. Milestone 4 (all tasks)
5. Milestone 5 (all tasks)
6. Milestone 6 (all tasks)

## Definition of Done (Per Milestone)

- [ ] Code is merged and builds successfully.
- [ ] Manual test pass completed in both editor and viewer.
- [ ] Any new controls are discoverable without extra documentation.
- [ ] No obvious hardcoded style regressions in touched areas.
