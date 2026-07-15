# Tailwind OKLCH Palette Tokens Design

## Goal

Expose the full Tailwind 4 base color palettes as first-class theme foundation colors, using Tailwind's OKLCH color values. Theme editor users should be able to pick these colors directly from the color input swatches and reference them as design tokens.

## Chosen Approach

Use direct foundation token paths:

```text
foundation.color.slate.50
foundation.color.red.500
foundation.color.sky.950
```

This intentionally changes the current theme structure instead of preserving compatibility with earlier in-progress theme drafts. The project has no users yet, so keeping the model simple is more valuable than adding aliases or migration shims.

## Data Model

Add a shared Tailwind palette source that contains every base palette family and shade from Tailwind 4:

- Palette families: `slate`, `gray`, `zinc`, `neutral`, `stone`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`.
- Shade steps: `50`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`, `950`.
- Values: OKLCH CSS strings from Tailwind 4, e.g. `oklch(...)`.

Default theme documents should include those palettes under `tokens.foundation.color`. Existing semantic tokens can continue using the current brand/status groups, but users can now change any editable color to reference a Tailwind token.

## Editor Behavior

The direct color picker should use Tailwind palette values for swatches instead of the current small hardcoded list. The reference selector should automatically include the new foundation tokens through the existing token traversal logic.

To keep the quick editor usable, Tailwind palette entries can appear in references/search, while grouped swatch presentation should prefer the existing Mantine `ColorInput` swatch support unless a custom picker becomes necessary.

## Validation And Types

Update theme validation and resolved theme types so the named Tailwind palette groups are valid foundation colors. Because compatibility is not required, the schema can accept the new structure directly without supporting old neutral-only assumptions beyond what the app still uses internally.

## Testing

Add or update focused tests to verify:

- Default theme documents include representative Tailwind OKLCH tokens.
- Reference options include paths like `{foundation.color.red.500}`.
- Direct color swatches are sourced from the shared Tailwind palette data.
- Theme document validation accepts the expanded foundation color structure.
