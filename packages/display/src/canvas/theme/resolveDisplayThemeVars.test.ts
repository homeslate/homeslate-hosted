import { describe, expect, it } from "vitest";
import { resolveDisplayThemeVars } from "./resolveDisplayThemeVars";
import { DEFAULT_THEME_DOCUMENTS } from "./defaults";

describe("resolveDisplayThemeVars", () => {
  it("falls back to the bundled default when themes is empty", () => {
    const vars = resolveDisplayThemeVars([], null, "dark");

    expect(vars["--token-spacing-1"]).toBe("4px");
    expect(vars["--token-spacing-4"]).toBe("16px");
    expect(vars["--token-widget-padding"]).toBe("12px");
    expect(vars["--token-surface-card"]).toBeTruthy();
  });

  it("uses the active theme document when themes are present", () => {
    const doc = DEFAULT_THEME_DOCUMENTS[1]; // Midnight
    const vars = resolveDisplayThemeVars([doc], doc.id, "dark");

    expect(vars["--token-spacing-1"]).toBe("4px");
    // Midnight brand color — distinct from Cosmos default (#6366f1)
    expect(vars["--token-color-brand-500"]).toBe("#3b82f6");
  });
});
