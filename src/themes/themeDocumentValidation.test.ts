import { describe, it, expect } from "vitest";
import { validateThemeDocument } from "./themeDocumentValidation";

function minimalDoc(): unknown {
  return {
    id: "test",
    name: "Test",
    version: 1,
    isActive: true,
    tokens: {
      foundation: {
        color: {
          brand: { "500": { $type: "color", $value: "#6366f1" } },
          neutral: { "500": { $type: "color", $value: "#6b7280" } },
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
            focus: {
              ring: { $type: "color", $value: "rgba(99,102,241,0.15)" },
            },
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
}

describe("validateThemeDocument", () => {
  it("accepts a minimal valid document", () => {
    const result = validateThemeDocument(minimalDoc());
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("accepts an alias reference in $value", () => {
    const doc = minimalDoc() as {
      tokens: {
        modes: {
          dark: { semantic: { text: { primary: { $value: string } } } };
        };
      };
    };
    doc.tokens.modes.dark.semantic.text.primary.$value =
      "{foundation.color.neutral.500}";
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(true);
  });

  it("rejects an unbalanced alias (missing close brace)", () => {
    const doc = minimalDoc() as {
      tokens: {
        modes: {
          dark: { semantic: { text: { primary: { $value: string } } } };
        };
      };
    };
    doc.tokens.modes.dark.semantic.text.primary.$value =
      "{foundation.color.neutral.500";
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("text.primary"))).toBe(
      true,
    );
  });

  it("rejects an empty alias path", () => {
    const doc = minimalDoc() as {
      tokens: {
        modes: {
          dark: { semantic: { text: { primary: { $value: string } } } };
        };
      };
    };
    doc.tokens.modes.dark.semantic.text.primary.$value = "{}";
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing required token", () => {
    const doc = minimalDoc() as {
      tokens: {
        modes: { dark: { semantic: { text: { primary?: unknown } } } };
      };
    };
    delete doc.tokens.modes.dark.semantic.text.primary;
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("text"))).toBe(true);
  });

  it("rejects an unknown key at strict level", () => {
    const doc = minimalDoc() as {
      tokens: { modes: { dark: { semantic: Record<string, unknown> } } };
    };
    (doc.tokens.modes.dark.semantic as Record<string, unknown>).bogus = {};
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
  });

  it("rejects a wrong leaf $type (color where dimension expected)", () => {
    const doc = minimalDoc() as {
      tokens: {
        foundation: { spacing: { "0": { $type: string; $value: unknown } } };
      };
    };
    doc.tokens.foundation.spacing["0"] = { $type: "color", $value: "#fff" };
    const result = validateThemeDocument(doc);
    expect(result.ok).toBe(false);
  });
});