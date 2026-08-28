# Theme Token Contract

This document is the human-readable companion to `packages/schema/schemas/theme-document.schema.json`.

## Canonical Artifacts

- Machine validation: `packages/schema/schemas/theme-document.schema.json`
- Product roadmap and rationale: `theming.md`

## Theme Document Shape

- Top-level metadata:
  - Required: `id`, `name`, `version`, `isActive`, `tokens`
  - Optional: `$schema`, `description`, `createdAt`, `updatedAt`
- Token root:
  - Required: `tokens.foundation`, `tokens.modes.dark`, `tokens.modes.light`

## Required Foundation Tokens

All of these are required for a valid theme:

- `foundation.color`:
  - Required groups: `brand`, `neutral`, `success`, `warning`, `danger`
  - Optional group: `info`
- `foundation.spacing`:
  - Required keys: `0`, `1`, `2`, `3`, `4`, `6`, `8`
  - Optional keys: `5`, `10`, `12`, `16`
- `foundation.radius`:
  - Required keys: `sm`, `md`, `lg`, `full`
  - Optional keys: `none`, `xl`
- `foundation.typography`:
  - Required groups: `family`, `size`, `weight`, `lineHeight`
  - `family` required: `base`, `mono` (optional: `display`)
  - `size` required: `xs`, `sm`, `md`, `lg`, `xl` (optional: `2xl`)
  - `weight` required: `regular`, `medium`, `semibold`, `bold`
  - `lineHeight` required: `tight`, `normal`, `relaxed`

## Optional Foundation Tokens

These enrich presentation but are not required:

- `foundation.shadow`: `xs`, `sm`, `md`, `lg`, `xl`
- `foundation.opacity`: `disabled`, `overlay`
- `foundation.zIndex`: `base`, `dropdown`, `modal`, `toast`
- `foundation.motion.duration`: `fast`, `normal`, `slow`
- `foundation.motion.easing`: `standard`, `emphasized`

## Required Mode Tokens (Per `dark` and `light`)

Each mode must provide `semantic` with all groups below:

- `semantic.surface` required keys: `canvas`, `sunken`, `card`, `overlay`
- `semantic.text` required keys: `primary`, `muted`, `inverse`, `link`
- `semantic.border` required keys: `subtle`, `default`, `strong`
- `semantic.focus` required key: `ring` (optional: `offset`)
- `semantic.status` required keys: `success`, `warning`, `danger` (optional: `info`)
  - each status key requires: `bg`, `fg`, `border`
- `semantic.interactive` required keys: `primary`, `secondary`, `ghost`
  - each interactive key requires: `bg`, `fg`, `border`, `hoverBg`, `activeBg`

## Optional Mode Component Tokens (Per `dark` and `light`)

`components` is optional. If present, it may include:

- `components.widget`: `background`, `borderColor`, `borderWidth`, `radius`, `shadow`, `padding`
- `components.toolbar`: `background`, `text`, `icon`, `divider`, `height`
- `components.badge`: `background`, `text`, `radius`, `paddingX`, `paddingY`
- `components.control`: `height`, `radius`, `borderColor`, `background`, `text`, `placeholder`

## Token Leaf Types

Token objects always use W3C-style leaf shape:

- Required: `"$value"`
- `"$type"` can be defined on the leaf or inherited from a parent token group
- Optional: `"$description"`

### Type inheritance

- If a token group defines `"$type"`, descendants inherit that type unless they override it.
- Example: put `"$type": "dimension"` on `foundation.spacing`, then child tokens only need `"$value"`.
- Validation accepts inherited types and checks the resolved effective type.

Supported concrete token types in schema:

- `color`
- `dimension`
- `fontFamily`
- `fontWeight`
- `duration`
- `shadow`
- `number`
- `string`

## Validation Rules

- `additionalProperties` is disabled for all strict contract objects.
- Missing required token keys fail schema validation.
- Unknown keys at strict levels fail schema validation.
- Optional token groups are accepted only when they follow the declared shape.
