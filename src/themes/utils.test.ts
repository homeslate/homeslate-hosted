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