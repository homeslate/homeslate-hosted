import { describe, it, expect } from "vitest";
import { DEFAULT_THEME_DOCUMENTS } from "./defaults";
import { validateThemeDocument } from "@homeslate/schema";
import { resolveTheme } from "./resolver";

describe("DEFAULT_THEME_DOCUMENTS — validation", () => {
  for (const doc of DEFAULT_THEME_DOCUMENTS) {
    it(`validates: ${doc.name}`, () => {
      const result = validateThemeDocument(doc);
      if (!result.ok) {
        throw new Error(
          `${doc.name} failed validation: ${JSON.stringify(result.issues, null, 2)}`,
        );
      }
      expect(result.ok).toBe(true);
    });
  }
});

describe("DEFAULT_THEME_DOCUMENTS — Tailwind palettes", () => {
  it("includes Tailwind 4 OKLCH color palettes as foundation tokens", () => {
    const doc = DEFAULT_THEME_DOCUMENTS[0];

    expect(doc.tokens.foundation.color.red["500"]).toEqual({
      $type: "color",
      $value: "oklch(63.7% 0.237 25.331)",
    });
    expect(doc.tokens.foundation.color.sky["950"]).toEqual({
      $type: "color",
      $value: "oklch(29.3% 0.066 243.157)",
    });
    expect(doc.tokens.foundation.color.mauve["500"]).toEqual({
      $type: "color",
      $value: "oklch(54.2% 0.034 322.5)",
    });
  });
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