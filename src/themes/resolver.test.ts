import { describe, it, expect } from "vitest";
import { resolveTheme, ThemeResolutionError } from "./resolver";
import type { ThemeDocument } from "./themeDocumentValidation";

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