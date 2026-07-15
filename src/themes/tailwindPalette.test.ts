import { describe, expect, it } from "vitest";
import {
  TAILWIND_COLOR_PALETTES,
  TAILWIND_COMPACT_COLOR_SWATCHES,
  TAILWIND_COLOR_SWATCHES,
  TAILWIND_PALETTE_NAMES,
  TAILWIND_PALETTE_STEPS,
  tailwindPaletteToTokenGroup,
} from "./tailwindPalette";

describe("Tailwind OKLCH palette data", () => {
  it("includes every Tailwind 4 palette family with every shade step", () => {
    expect(TAILWIND_PALETTE_NAMES).toEqual([
      "slate",
      "gray",
      "zinc",
      "neutral",
      "stone",
      "red",
      "orange",
      "amber",
      "yellow",
      "lime",
      "green",
      "emerald",
      "teal",
      "cyan",
      "sky",
      "blue",
      "indigo",
      "violet",
      "purple",
      "fuchsia",
      "pink",
      "rose",
      "mauve",
      "olive",
      "mist",
      "taupe",
    ]);
    expect(TAILWIND_PALETTE_STEPS).toEqual([
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
      "950",
    ]);

    for (const name of TAILWIND_PALETTE_NAMES) {
      expect(Object.keys(TAILWIND_COLOR_PALETTES[name])).toEqual(TAILWIND_PALETTE_STEPS);
    }
  });

  it("stores Tailwind 4 OKLCH values", () => {
    expect(TAILWIND_COLOR_PALETTES.red["500"]).toBe("oklch(63.7% 0.237 25.331)");
    expect(TAILWIND_COLOR_PALETTES.slate["950"]).toBe("oklch(12.9% 0.042 264.695)");
    expect(TAILWIND_COLOR_PALETTES.mist["500"]).toBe("oklch(56% 0.021 213.5)");
  });

  it("converts palettes into theme color token groups", () => {
    const tokens = tailwindPaletteToTokenGroup();

    expect(tokens.red["500"]).toEqual({
      $type: "color",
      $value: "oklch(63.7% 0.237 25.331)",
    });
    expect(tokens.sky["950"]).toEqual({
      $type: "color",
      $value: "oklch(29.3% 0.066 243.157)",
    });
  });

  it("flattens palette values for direct color swatches", () => {
    expect(TAILWIND_COLOR_SWATCHES).toHaveLength(
      TAILWIND_PALETTE_NAMES.length * TAILWIND_PALETTE_STEPS.length,
    );
    expect(TAILWIND_COLOR_SWATCHES).toContain("oklch(63.7% 0.237 25.331)");
    expect(TAILWIND_COLOR_SWATCHES[0]).toBe(TAILWIND_COLOR_PALETTES.slate["50"]);
  });

  it("keeps compact swatches small enough for inline color inputs", () => {
    expect(TAILWIND_COMPACT_COLOR_SWATCHES.length).toBeLessThan(TAILWIND_COLOR_SWATCHES.length);
    expect(TAILWIND_COMPACT_COLOR_SWATCHES.length).toBeLessThanOrEqual(36);
    expect(TAILWIND_COMPACT_COLOR_SWATCHES).toContain(TAILWIND_COLOR_PALETTES.red["500"]);
    expect(TAILWIND_COMPACT_COLOR_SWATCHES).toContain(TAILWIND_COLOR_PALETTES.neutral["950"]);
  });
});
