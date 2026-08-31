# Theming Overhaul Roadmap

Simple execution plan focused on making theming world class for a single-user setup.

## Working Rules

- No backward-compatibility work.
- No dual schema or "v2" naming.
- Build for current app behavior first, then optimize.
- Finish one milestone before starting the next.
- Theme source of truth is a W3C Design Tokens JSON document (with one app-defined wrapper shape).
- Persist themes in DB as that same JSON payload; GUI edits always read/write this canonical payload.

## Canonical Theme Document (Draft)

This is the concrete JSON shape to use for DB storage, import/export, and editor saves.

Canonical files:

- `schemas/theme-document.schema.json` (machine validation contract)
- `docs/theme-token-contract.md` (human-readable required/optional matrix)

### Example payload

```json
{
  "$schema": "https://homeslate.dev/schemas/theme-document.schema.json",
  "id": "theme_ocean_dark",
  "name": "Ocean Dark",
  "description": "Low-glare dark theme with cyan accents",
  "version": 1,
  "isActive": true,
  "createdAt": "2026-03-18T12:00:00.000Z",
  "updatedAt": "2026-03-18T12:00:00.000Z",
  "tokens": {
    "foundation": {
      "color": {
        "blue": {
          "500": { "$type": "color", "$value": "#12A8FF" }
        },
        "gray": {
          "900": { "$type": "color", "$value": "#0F172A" },
          "100": { "$type": "color", "$value": "#E2E8F0" }
        }
      },
      "spacing": {
        "2": { "$type": "dimension", "$value": "8px" },
        "3": { "$type": "dimension", "$value": "12px" }
      },
      "radius": {
        "md": { "$type": "dimension", "$value": "10px" }
      },
      "typography": {
        "family": {
          "base": { "$type": "fontFamily", "$value": "Inter, sans-serif" }
        },
        "size": {
          "md": { "$type": "dimension", "$value": "16px" }
        },
        "weight": {
          "regular": { "$type": "fontWeight", "$value": 400 }
        }
      }
    },
    "modes": {
      "dark": {
        "semantic": {
          "surface": {
            "canvas": { "$type": "color", "$value": "{foundation.color.gray.900}" },
            "card": { "$type": "color", "$value": "#111827" }
          },
          "text": {
            "primary": { "$type": "color", "$value": "#F8FAFC" },
            "muted": { "$type": "color", "$value": "{foundation.color.gray.100}" }
          },
          "border": {
            "default": { "$type": "color", "$value": "rgba(148,163,184,0.24)" }
          },
          "focus": {
            "ring": { "$type": "color", "$value": "{foundation.color.blue.500}" }
          }
        },
        "components": {
          "widget": {
            "background": { "$type": "color", "$value": "{modes.dark.semantic.surface.card}" },
            "radius": { "$type": "dimension", "$value": "{foundation.radius.md}" }
          }
        }
      },
      "light": {
        "semantic": {
          "surface": {
            "canvas": { "$type": "color", "$value": "#F8FAFC" },
            "card": { "$type": "color", "$value": "#FFFFFF" }
          },
          "text": {
            "primary": { "$type": "color", "$value": "#0F172A" },
            "muted": { "$type": "color", "$value": "#475569" }
          }
        }
      }
    }
  }
}
```

### Defined token contract (required vs optional)

Required tokens are the minimum for a valid, render-safe theme:

- Foundation (global): `color`, `spacing`, `radius`, `typography`
- Per mode (`dark`, `light`): `semantic.surface`, `semantic.text`, `semantic.border`, `semantic.focus`, `semantic.status`, `semantic.interactive`

Optional tokens provide richer styling but are not required for baseline rendering:

- Foundation: `shadow`, `opacity`, `zIndex`, `motion`
- Per mode: `components` (widget/toolbar/badge/control token groups)
- Metadata: `description`, timestamps

### JSON Schema (strict draft)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://homeslate.dev/schemas/theme-document.schema.json",
  "title": "ThemeDocument",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "name", "version", "isActive", "tokens"],
  "properties": {
    "$schema": { "type": "string" },
    "id": { "type": "string", "minLength": 1, "maxLength": 100 },
    "name": { "type": "string", "minLength": 1, "maxLength": 120 },
    "description": { "type": "string", "maxLength": 500 },
    "version": { "type": "integer", "minimum": 1 },
    "isActive": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
    "tokens": {
      "type": "object",
      "additionalProperties": false,
      "required": ["foundation", "modes"],
      "properties": {
        "foundation": { "$ref": "#/$defs/foundationTokens" },
        "modes": {
          "type": "object",
          "additionalProperties": false,
          "required": ["dark", "light"],
          "properties": {
            "dark": { "$ref": "#/$defs/modeGroup" },
            "light": { "$ref": "#/$defs/modeGroup" }
          }
        }
      }
    }
  },
  "$defs": {
    "modeGroup": {
      "type": "object",
      "additionalProperties": false,
      "required": ["semantic"],
      "properties": {
        "semantic": { "$ref": "#/$defs/semanticTokens" },
        "components": { "$ref": "#/$defs/componentTokens" }
      }
    },
    "tokenGroup": {
      "type": "object",
      "additionalProperties": {
        "anyOf": [
          { "$ref": "#/$defs/tokenGroup" },
          { "$ref": "#/$defs/tokenLeaf" }
        ]
      }
    },
    "foundationTokens": {
      "type": "object",
      "additionalProperties": false,
      "required": ["color", "spacing", "radius", "typography"],
      "properties": {
        "color": {
          "type": "object",
          "additionalProperties": false,
          "required": ["brand", "neutral", "success", "warning", "danger"],
          "properties": {
            "brand": { "$ref": "#/$defs/tokenGroup" },
            "neutral": { "$ref": "#/$defs/tokenGroup" },
            "success": { "$ref": "#/$defs/tokenGroup" },
            "warning": { "$ref": "#/$defs/tokenGroup" },
            "danger": { "$ref": "#/$defs/tokenGroup" },
            "info": { "$ref": "#/$defs/tokenGroup" }
          }
        },
        "spacing": {
          "type": "object",
          "additionalProperties": false,
          "required": ["0", "1", "2", "3", "4", "6", "8"],
          "properties": {
            "0": { "$ref": "#/$defs/dimensionToken" },
            "1": { "$ref": "#/$defs/dimensionToken" },
            "2": { "$ref": "#/$defs/dimensionToken" },
            "3": { "$ref": "#/$defs/dimensionToken" },
            "4": { "$ref": "#/$defs/dimensionToken" },
            "5": { "$ref": "#/$defs/dimensionToken" },
            "6": { "$ref": "#/$defs/dimensionToken" },
            "8": { "$ref": "#/$defs/dimensionToken" },
            "10": { "$ref": "#/$defs/dimensionToken" },
            "12": { "$ref": "#/$defs/dimensionToken" },
            "16": { "$ref": "#/$defs/dimensionToken" }
          }
        },
        "radius": {
          "type": "object",
          "additionalProperties": false,
          "required": ["sm", "md", "lg", "full"],
          "properties": {
            "none": { "$ref": "#/$defs/dimensionToken" },
            "sm": { "$ref": "#/$defs/dimensionToken" },
            "md": { "$ref": "#/$defs/dimensionToken" },
            "lg": { "$ref": "#/$defs/dimensionToken" },
            "xl": { "$ref": "#/$defs/dimensionToken" },
            "full": { "$ref": "#/$defs/dimensionToken" }
          }
        },
        "typography": {
          "type": "object",
          "additionalProperties": false,
          "required": ["family", "size", "weight", "lineHeight"],
          "properties": {
            "family": {
              "type": "object",
              "additionalProperties": false,
              "required": ["base", "mono"],
              "properties": {
                "base": { "$ref": "#/$defs/fontFamilyToken" },
                "mono": { "$ref": "#/$defs/fontFamilyToken" },
                "display": { "$ref": "#/$defs/fontFamilyToken" }
              }
            },
            "size": {
              "type": "object",
              "additionalProperties": false,
              "required": ["xs", "sm", "md", "lg", "xl"],
              "properties": {
                "xs": { "$ref": "#/$defs/dimensionToken" },
                "sm": { "$ref": "#/$defs/dimensionToken" },
                "md": { "$ref": "#/$defs/dimensionToken" },
                "lg": { "$ref": "#/$defs/dimensionToken" },
                "xl": { "$ref": "#/$defs/dimensionToken" },
                "2xl": { "$ref": "#/$defs/dimensionToken" }
              }
            },
            "weight": {
              "type": "object",
              "additionalProperties": false,
              "required": ["regular", "medium", "semibold", "bold"],
              "properties": {
                "regular": { "$ref": "#/$defs/fontWeightToken" },
                "medium": { "$ref": "#/$defs/fontWeightToken" },
                "semibold": { "$ref": "#/$defs/fontWeightToken" },
                "bold": { "$ref": "#/$defs/fontWeightToken" }
              }
            },
            "lineHeight": {
              "type": "object",
              "additionalProperties": false,
              "required": ["tight", "normal", "relaxed"],
              "properties": {
                "tight": { "$ref": "#/$defs/numberToken" },
                "normal": { "$ref": "#/$defs/numberToken" },
                "relaxed": { "$ref": "#/$defs/numberToken" }
              }
            }
          }
        },
        "shadow": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "xs": { "$ref": "#/$defs/shadowToken" },
            "sm": { "$ref": "#/$defs/shadowToken" },
            "md": { "$ref": "#/$defs/shadowToken" },
            "lg": { "$ref": "#/$defs/shadowToken" },
            "xl": { "$ref": "#/$defs/shadowToken" }
          }
        },
        "opacity": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "disabled": { "$ref": "#/$defs/numberToken" },
            "overlay": { "$ref": "#/$defs/numberToken" }
          }
        },
        "zIndex": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "base": { "$ref": "#/$defs/numberToken" },
            "dropdown": { "$ref": "#/$defs/numberToken" },
            "modal": { "$ref": "#/$defs/numberToken" },
            "toast": { "$ref": "#/$defs/numberToken" }
          }
        },
        "motion": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "duration": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "fast": { "$ref": "#/$defs/durationToken" },
                "normal": { "$ref": "#/$defs/durationToken" },
                "slow": { "$ref": "#/$defs/durationToken" }
              }
            },
            "easing": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "standard": { "$ref": "#/$defs/stringToken" },
                "emphasized": { "$ref": "#/$defs/stringToken" }
              }
            }
          }
        }
      }
    },
    "semanticTokens": {
      "type": "object",
      "additionalProperties": false,
      "required": ["surface", "text", "border", "focus", "status", "interactive"],
      "properties": {
        "surface": {
          "type": "object",
          "additionalProperties": false,
          "required": ["canvas", "sunken", "card", "overlay"],
          "properties": {
            "canvas": { "$ref": "#/$defs/colorToken" },
            "sunken": { "$ref": "#/$defs/colorToken" },
            "card": { "$ref": "#/$defs/colorToken" },
            "overlay": { "$ref": "#/$defs/colorToken" }
          }
        },
        "text": {
          "type": "object",
          "additionalProperties": false,
          "required": ["primary", "muted", "inverse", "link"],
          "properties": {
            "primary": { "$ref": "#/$defs/colorToken" },
            "muted": { "$ref": "#/$defs/colorToken" },
            "inverse": { "$ref": "#/$defs/colorToken" },
            "link": { "$ref": "#/$defs/colorToken" }
          }
        },
        "border": {
          "type": "object",
          "additionalProperties": false,
          "required": ["subtle", "default", "strong"],
          "properties": {
            "subtle": { "$ref": "#/$defs/colorToken" },
            "default": { "$ref": "#/$defs/colorToken" },
            "strong": { "$ref": "#/$defs/colorToken" }
          }
        },
        "focus": {
          "type": "object",
          "additionalProperties": false,
          "required": ["ring"],
          "properties": {
            "ring": { "$ref": "#/$defs/colorToken" },
            "offset": { "$ref": "#/$defs/colorToken" }
          }
        },
        "status": {
          "type": "object",
          "additionalProperties": false,
          "required": ["success", "warning", "danger"],
          "properties": {
            "success": { "$ref": "#/$defs/stateTriplet" },
            "warning": { "$ref": "#/$defs/stateTriplet" },
            "danger": { "$ref": "#/$defs/stateTriplet" },
            "info": { "$ref": "#/$defs/stateTriplet" }
          }
        },
        "interactive": {
          "type": "object",
          "additionalProperties": false,
          "required": ["primary", "secondary", "ghost"],
          "properties": {
            "primary": { "$ref": "#/$defs/interactiveTriplet" },
            "secondary": { "$ref": "#/$defs/interactiveTriplet" },
            "ghost": { "$ref": "#/$defs/interactiveTriplet" }
          }
        }
      }
    },
    "componentTokens": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "widget": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "background": { "$ref": "#/$defs/colorToken" },
            "borderColor": { "$ref": "#/$defs/colorToken" },
            "borderWidth": { "$ref": "#/$defs/dimensionToken" },
            "radius": { "$ref": "#/$defs/dimensionToken" },
            "shadow": { "$ref": "#/$defs/shadowToken" },
            "padding": { "$ref": "#/$defs/dimensionToken" }
          }
        },
        "toolbar": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "background": { "$ref": "#/$defs/colorToken" },
            "text": { "$ref": "#/$defs/colorToken" },
            "icon": { "$ref": "#/$defs/colorToken" },
            "divider": { "$ref": "#/$defs/colorToken" },
            "height": { "$ref": "#/$defs/dimensionToken" }
          }
        },
        "badge": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "background": { "$ref": "#/$defs/colorToken" },
            "text": { "$ref": "#/$defs/colorToken" },
            "radius": { "$ref": "#/$defs/dimensionToken" },
            "paddingX": { "$ref": "#/$defs/dimensionToken" },
            "paddingY": { "$ref": "#/$defs/dimensionToken" }
          }
        },
        "control": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "height": { "$ref": "#/$defs/dimensionToken" },
            "radius": { "$ref": "#/$defs/dimensionToken" },
            "borderColor": { "$ref": "#/$defs/colorToken" },
            "background": { "$ref": "#/$defs/colorToken" },
            "text": { "$ref": "#/$defs/colorToken" },
            "placeholder": { "$ref": "#/$defs/colorToken" }
          }
        }
      }
    },
    "stateTriplet": {
      "type": "object",
      "additionalProperties": false,
      "required": ["bg", "fg", "border"],
      "properties": {
        "bg": { "$ref": "#/$defs/colorToken" },
        "fg": { "$ref": "#/$defs/colorToken" },
        "border": { "$ref": "#/$defs/colorToken" }
      }
    },
    "interactiveTriplet": {
      "type": "object",
      "additionalProperties": false,
      "required": ["bg", "fg", "border", "hoverBg", "activeBg"],
      "properties": {
        "bg": { "$ref": "#/$defs/colorToken" },
        "fg": { "$ref": "#/$defs/colorToken" },
        "border": { "$ref": "#/$defs/colorToken" },
        "hoverBg": { "$ref": "#/$defs/colorToken" },
        "activeBg": { "$ref": "#/$defs/colorToken" }
      }
    },
    "colorToken": {
      "type": "object",
      "additionalProperties": false,
      "required": ["$type", "$value"],
      "properties": {
        "$type": { "const": "color" },
        "$value": { "type": "string" },
        "$description": { "type": "string" }
      }
    },
    "dimensionToken": {
      "type": "object",
      "additionalProperties": false,
      "required": ["$type", "$value"],
      "properties": {
        "$type": { "const": "dimension" },
        "$value": { "type": "string" },
        "$description": { "type": "string" }
      }
    },
    "fontFamilyToken": {
      "type": "object",
      "additionalProperties": false,
      "required": ["$type", "$value"],
      "properties": {
        "$type": { "const": "fontFamily" },
        "$value": { "type": "string" },
        "$description": { "type": "string" }
      }
    },
    "fontWeightToken": {
      "type": "object",
      "additionalProperties": false,
      "required": ["$type", "$value"],
      "properties": {
        "$type": { "const": "fontWeight" },
        "$value": { "type": ["string", "number"] },
        "$description": { "type": "string" }
      }
    },
    "durationToken": {
      "type": "object",
      "additionalProperties": false,
      "required": ["$type", "$value"],
      "properties": {
        "$type": { "const": "duration" },
        "$value": { "type": "string" },
        "$description": { "type": "string" }
      }
    },
    "numberToken": {
      "type": "object",
      "additionalProperties": false,
      "required": ["$type", "$value"],
      "properties": {
        "$type": { "const": "number" },
        "$value": { "type": "number" },
        "$description": { "type": "string" }
      }
    },
    "stringToken": {
      "type": "object",
      "additionalProperties": false,
      "required": ["$type", "$value"],
      "properties": {
        "$type": { "const": "string" },
        "$value": { "type": "string" },
        "$description": { "type": "string" }
      }
    },
    "shadowToken": {
      "type": "object",
      "additionalProperties": false,
      "required": ["$type", "$value"],
      "properties": {
        "$type": { "const": "shadow" },
        "$value": {},
        "$description": { "type": "string" }
      }
    },
    "tokenLeaf": {
      "type": "object",
      "additionalProperties": false,
      "required": ["$type", "$value"],
      "properties": {
        "$type": {
          "type": "string",
          "enum": [
            "color",
            "dimension",
            "fontFamily",
            "fontWeight",
            "duration",
            "shadow",
            "number",
            "string"
          ]
        },
        "$value": {},
        "$description": { "type": "string" }
      }
    }
  }
}
```

### Notes for implementation

- Theme resolver should accept this document and operate on `tokens.modes[activeMode]` with fallback to `tokens.foundation`.
- Import flow uses this schema for validation; GUI editor writes exactly this structure.
- DB stores one document per theme; active theme selection is controlled by `isActive` + atomic activation logic.

## Milestone 1: Theme Foundation and Token Model

Goal: replace the current basic theme shape with a complete token system.

### Tasks

- [ ] Redefine `DisplayTheme` to support:
  - foundation tokens (palette, typography, spacing, radius, shadow)
  - semantic tokens (surface, text, borders, states)
  - component tokens (widget shell, toolbar, badges, controls)
  - mode blocks (`dark`, `light`)
- [ ] Define the canonical persisted theme document shape:
  - [ ] W3C design tokens payload as the core (`$value`, `$type`, token groups)
  - [ ] app metadata wrapper (for example: `id`, `name`, `description`, `version`, `isActive`)
  - [ ] one JSON schema + runtime validator used by API, import flow, and editor save
- [ ] Store each theme in DB as the canonical JSON document (no alternate internal format).
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
  - [ ] Replace current flat fields with structured tokens following W3C token conventions:
    - [ ] `foundation` (palette, typography, spacing, radius, shadow)
    - [ ] `semantic` (background/surface/text/border/status/focus)
    - [ ] `components` (widget, toolbar, indicators, badges)
    - [ ] `modes.dark` and `modes.light`
  - [ ] Keep `ColorMode` as `dark | light`.
  - [ ] Add top-level persisted theme document type (metadata + W3C tokens body).
  - [ ] Add helper types for deep partial overrides (used later by overrides).

#### Step 1a: Define theme persistence model

- [ ] Add DB model/repository support for multiple saved themes per user/workspace.
- [ ] Add a single explicit active theme reference:
  - [ ] one active theme id at a time
  - [ ] activation operation is atomic (deactivate old, activate new)
- [ ] Ensure app boot/runtime always resolves tokens from the active persisted theme document.

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
- [ ] Build a full GUI token editor so users never need to hand-author JSON for normal edits.
- [ ] GUI editor writes back to the canonical W3C token JSON structure.
- [ ] Add theme library panel:
  - [ ] create/save multiple themes
  - [ ] set one theme as active
  - [ ] duplicate and delete themes

### Exit Criteria

- Full theme editing can be done from UI with no code edits.
- Creating and tweaking a custom theme is fast and obvious.
- Multiple saved themes can be managed from UI, with exactly one active theme.

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
- [ ] Add theme import/export as canonical W3C Design Tokens JSON document.
- [ ] Add import paths for:
  - [ ] file upload (`.json`)
  - [ ] copy/paste raw JSON text
- [ ] Validate imported payloads against canonical schema and show clear field-level errors.
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
