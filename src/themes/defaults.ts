import type { ThemeDocument } from "./themeDocumentValidation";

const SCHEMA_URL = "https://homeslate.app/schemas/theme-document.schema.json";

const SHARED_SPACING = {
  "0": { $type: "dimension", $value: "0px" },
  "1": { $type: "dimension", $value: "4px" },
  "2": { $type: "dimension", $value: "8px" },
  "3": { $type: "dimension", $value: "12px" },
  "4": { $type: "dimension", $value: "16px" },
  "6": { $type: "dimension", $value: "24px" },
  "8": { $type: "dimension", $value: "32px" },
  "12": { $type: "dimension", $value: "48px" },
  "16": { $type: "dimension", $value: "64px" },
} as const;

const SHARED_RADIUS = {
  none: { $type: "dimension", $value: "0px" },
  sm: { $type: "dimension", $value: "6px" },
  md: { $type: "dimension", $value: "10px" },
  lg: { $type: "dimension", $value: "14px" },
  xl: { $type: "dimension", $value: "18px" },
  full: { $type: "dimension", $value: "9999px" },
} as const;

const SHARED_TYPOGRAPHY_REST = {
  size: {
    xs: { $type: "dimension", $value: "12px" },
    sm: { $type: "dimension", $value: "14px" },
    md: { $type: "dimension", $value: "16px" },
    lg: { $type: "dimension", $value: "18px" },
    xl: { $type: "dimension", $value: "20px" },
    "2xl": { $type: "dimension", $value: "24px" },
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
} as const;

const NEUTRAL_PALETTE = {
  "50": { $type: "color", $value: "#fafafa" },
  "100": { $type: "color", $value: "#f3f4f6" },
  "200": { $type: "color", $value: "#e5e7eb" },
  "300": { $type: "color", $value: "#d1d5db" },
  "400": { $type: "color", $value: "#9ca3af" },
  "500": { $type: "color", $value: "#6b7280" },
  "600": { $type: "color", $value: "#4b5563" },
  "700": { $type: "color", $value: "#374151" },
  "800": { $type: "color", $value: "#1f2937" },
  "900": { $type: "color", $value: "#111827" },
} as const;

const STATUS_COLORS = {
  success: {
    "500": { $type: "color", $value: "#22c55e" },
    "600": { $type: "color", $value: "#16a34a" },
  },
  warning: {
    "500": { $type: "color", $value: "#f59e0b" },
    "600": { $type: "color", $value: "#d97706" },
  },
  danger: {
    "500": { $type: "color", $value: "#ef4444" },
    "600": { $type: "color", $value: "#dc2626" },
  },
  info: {
    "500": { $type: "color", $value: "#0ea5e9" },
    "600": { $type: "color", $value: "#0284c7" },
  },
} as const;

interface ThemeSeed {
  id: string;
  name: string;
  brand: { "500": string; "600": string };
  fontFamily: string;
  dark: ModeSeed;
  light: ModeSeed;
}

interface ModeSeed {
  canvas: string;
  card: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  glow: string;
}

const SEEDS: ThemeSeed[] = [
  {
    id: "cosmos",
    name: "Cosmos",
    brand: { "500": "#6366f1", "600": "#a855f7" },
    fontFamily: "'Outfit', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)",
        "radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)",
        "radial-gradient(ellipse at 50% 50%, rgba(16, 185, 129, 0.05) 0%, transparent 50%)",
        "#0a0a0f",
      ].join(", "),
      card: "rgba(30, 30, 40, 0.6)",
      border: "rgba(255, 255, 255, 0.08)",
      textPrimary: "#e8e8f0",
      textMuted: "#6c6c7e",
      glow: "rgba(99, 102, 241, 0.3)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)",
        "radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)",
        "#f5f4ff",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.85)",
      border: "rgba(99, 102, 241, 0.15)",
      textPrimary: "#1a1a2e",
      textMuted: "#6b6b7e",
      glow: "rgba(99, 102, 241, 0.15)",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    brand: { "500": "#3b82f6", "600": "#60a5fa" },
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    dark: {
      canvas: "#080c14",
      card: "rgba(15, 20, 35, 0.85)",
      border: "rgba(255, 255, 255, 0.06)",
      textPrimary: "#e2e8f0",
      textMuted: "#64748b",
      glow: "rgba(59, 130, 246, 0.2)",
    },
    light: {
      canvas: "#eef3fb",
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(59, 130, 246, 0.15)",
      textPrimary: "#0f172a",
      textMuted: "#64748b",
      glow: "rgba(59, 130, 246, 0.1)",
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    brand: { "500": "#10b981", "600": "#34d399" },
    fontFamily: "'DM Sans', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 30% 70%, rgba(16, 185, 129, 0.15) 0%, transparent 60%)",
        "radial-gradient(ellipse at 70% 20%, rgba(52, 211, 153, 0.08) 0%, transparent 50%)",
        "#060f0d",
      ].join(", "),
      card: "rgba(16, 28, 25, 0.7)",
      border: "rgba(16, 185, 129, 0.15)",
      textPrimary: "#d1fae5",
      textMuted: "#6b7280",
      glow: "rgba(16, 185, 129, 0.25)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 30% 70%, rgba(16, 185, 129, 0.08) 0%, transparent 60%)",
        "#f0fdf8",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.85)",
      border: "rgba(16, 185, 129, 0.2)",
      textPrimary: "#064e3b",
      textMuted: "#6b7280",
      glow: "rgba(16, 185, 129, 0.12)",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    brand: { "500": "#f59e0b", "600": "#ef4444" },
    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 20% 80%, rgba(245, 158, 11, 0.15) 0%, transparent 60%)",
        "radial-gradient(ellipse at 75% 15%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)",
        "#100804",
      ].join(", "),
      card: "rgba(30, 18, 10, 0.7)",
      border: "rgba(245, 158, 11, 0.12)",
      textPrimary: "#fef3c7",
      textMuted: "#78716c",
      glow: "rgba(245, 158, 11, 0.25)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 20% 80%, rgba(245, 158, 11, 0.08) 0%, transparent 60%)",
        "radial-gradient(ellipse at 75% 15%, rgba(239, 68, 68, 0.05) 0%, transparent 50%)",
        "#fffbf0",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(245, 158, 11, 0.2)",
      textPrimary: "#431407",
      textMuted: "#78716c",
      glow: "rgba(245, 158, 11, 0.1)",
    },
  },
  {
    id: "neon",
    name: "Neon",
    brand: { "500": "#f0abfc", "600": "#67e8f9" },
    fontFamily: "'Sora', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 30% 40%, rgba(240, 171, 252, 0.1) 0%, transparent 50%)",
        "radial-gradient(ellipse at 70% 60%, rgba(103, 232, 249, 0.07) 0%, transparent 50%)",
        "#02020a",
      ].join(", "),
      card: "rgba(15, 8, 25, 0.85)",
      border: "rgba(240, 171, 252, 0.15)",
      textPrimary: "#fce7f3",
      textMuted: "#6b7280",
      glow: "rgba(240, 171, 252, 0.3)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 30% 40%, rgba(192, 38, 211, 0.06) 0%, transparent 50%)",
        "radial-gradient(ellipse at 70% 60%, rgba(6, 182, 212, 0.05) 0%, transparent 50%)",
        "#fdf4ff",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(192, 38, 211, 0.15)",
      textPrimary: "#3b0764",
      textMuted: "#6b7280",
      glow: "rgba(192, 38, 211, 0.1)",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    brand: { "500": "#06b6d4", "600": "#0ea5e9" },
    fontFamily: "'Nunito', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 40% 60%, rgba(6, 182, 212, 0.15) 0%, transparent 60%)",
        "radial-gradient(ellipse at 70% 20%, rgba(14, 165, 233, 0.1) 0%, transparent 50%)",
        "#020b14",
      ].join(", "),
      card: "rgba(10, 20, 40, 0.7)",
      border: "rgba(6, 182, 212, 0.15)",
      textPrimary: "#e0f2fe",
      textMuted: "#64748b",
      glow: "rgba(6, 182, 212, 0.25)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 40% 60%, rgba(6, 182, 212, 0.07) 0%, transparent 60%)",
        "#f0f9ff",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(6, 182, 212, 0.2)",
      textPrimary: "#0c4a6e",
      textMuted: "#64748b",
      glow: "rgba(6, 182, 212, 0.1)",
    },
  },
  {
    id: "forest",
    name: "Forest",
    brand: { "500": "#22c55e", "600": "#86efac" },
    fontFamily: "'DM Sans', 'Inter', sans-serif",
    dark: {
      canvas: [
        "radial-gradient(ellipse at 30% 60%, rgba(34, 197, 94, 0.12) 0%, transparent 60%)",
        "radial-gradient(ellipse at 70% 20%, rgba(134, 239, 172, 0.07) 0%, transparent 50%)",
        "#030f06",
      ].join(", "),
      card: "rgba(8, 20, 12, 0.75)",
      border: "rgba(34, 197, 94, 0.12)",
      textPrimary: "#dcfce7",
      textMuted: "#6b7280",
      glow: "rgba(34, 197, 94, 0.2)",
    },
    light: {
      canvas: [
        "radial-gradient(ellipse at 30% 60%, rgba(34, 197, 94, 0.07) 0%, transparent 60%)",
        "#f0fdf4",
      ].join(", "),
      card: "rgba(255, 255, 255, 0.9)",
      border: "rgba(34, 197, 94, 0.2)",
      textPrimary: "#14532d",
      textMuted: "#6b7280",
      glow: "rgba(34, 197, 94, 0.1)",
    },
  },
  {
    id: "paper",
    name: "Paper",
    brand: { "500": "#4338ca", "600": "#7c3aed" },
    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
    dark: {
      canvas: "#16161e",
      card: "rgba(30, 30, 42, 0.85)",
      border: "rgba(255, 255, 255, 0.08)",
      textPrimary: "#e8e8f0",
      textMuted: "#6b7280",
      glow: "rgba(124, 58, 237, 0.2)",
    },
    light: {
      canvas: "#f5f5f7",
      card: "rgba(255, 255, 255, 0.85)",
      border: "rgba(0, 0, 0, 0.08)",
      textPrimary: "#1a1b1e",
      textMuted: "#6b7280",
      glow: "rgba(67, 56, 202, 0.15)",
    },
  },
];

function color(value: string) {
  return { $type: "color" as const, $value: value };
}

function modeBlock(seed: ModeSeed, _isDark: boolean) {
  return {
    semantic: {
      surface: {
        canvas: color(seed.canvas),
        sunken: color(seed.canvas),
        card: color(seed.card),
        overlay: color(seed.card),
      },
      text: {
        primary: color(seed.textPrimary),
        muted: color(seed.textMuted),
        inverse: color(_isDark ? "#101828" : "#f8fafc"),
        link: color("{foundation.color.brand.500}"),
      },
      border: {
        subtle: color(seed.border),
        default: color(seed.border),
        strong: color("{foundation.color.brand.500}"),
      },
      focus: {
        ring: color(seed.glow),
      },
      status: {
        success: {
          bg: color(_isDark ? "#166534" : "#dcfce7"),
          fg: color(_isDark ? "#dcfce7" : "#166534"),
          border: color("{foundation.color.success.500}"),
        },
        warning: {
          bg: color(_isDark ? "#92400e" : "#fef3c7"),
          fg: color(_isDark ? "#fef3c7" : "#92400e"),
          border: color("{foundation.color.warning.500}"),
        },
        danger: {
          bg: color(_isDark ? "#991b1b" : "#fee2e2"),
          fg: color(_isDark ? "#fee2e2" : "#991b1b"),
          border: color("{foundation.color.danger.500}"),
        },
      },
      interactive: {
        primary: {
          bg: color("{foundation.color.brand.500}"),
          fg: color("#ffffff"),
          border: color("{foundation.color.brand.500}"),
          hoverBg: color("{foundation.color.brand.600}"),
          activeBg: color("{foundation.color.brand.600}"),
        },
        secondary: {
          bg: color(seed.card),
          fg: color(seed.textPrimary),
          border: color(seed.border),
          hoverBg: color(seed.card),
          activeBg: color(seed.card),
        },
        ghost: {
          bg: color("transparent"),
          fg: color(seed.textPrimary),
          border: color("transparent"),
          hoverBg: color(seed.card),
          activeBg: color(seed.card),
        },
      },
    },
    components: {
      widget: {
        background: color(seed.card),
        borderColor: color(seed.border),
        borderWidth: { $type: "dimension" as const, $value: "1px" },
        radius: { $type: "dimension" as const, $value: "12px" },
        padding: { $type: "dimension" as const, $value: "12px" },
      },
      toolbar: {
        background: color(seed.card),
        text: color(seed.textPrimary),
        icon: color(seed.textMuted),
        divider: color(seed.border),
        height: { $type: "dimension" as const, $value: "56px" },
      },
      badge: {
        background: color("{foundation.color.brand.500}"),
        text: color("#ffffff"),
        radius: { $type: "dimension" as const, $value: "9999px" },
        paddingX: { $type: "dimension" as const, $value: "10px" },
        paddingY: { $type: "dimension" as const, $value: "4px" },
      },
      control: {
        height: { $type: "dimension" as const, $value: "36px" },
        radius: { $type: "dimension" as const, $value: "8px" },
        borderColor: color(seed.border),
        background: color(seed.card),
        text: color(seed.textPrimary),
        placeholder: color(seed.textMuted),
      },
    },
  };
}

function buildDocument(seed: ThemeSeed): ThemeDocument {
  return {
    $schema: SCHEMA_URL,
    id: `theme_${seed.id}`,
    name: seed.name,
    version: 1,
    isActive: false,
    tokens: {
      foundation: {
        color: {
          brand: {
            "500": color(seed.brand["500"]),
            "600": color(seed.brand["600"]),
          },
          neutral: NEUTRAL_PALETTE,
          success: STATUS_COLORS.success,
          warning: STATUS_COLORS.warning,
          danger: STATUS_COLORS.danger,
          info: STATUS_COLORS.info,
        },
        spacing: SHARED_SPACING,
        radius: SHARED_RADIUS,
        typography: {
          family: {
            base: { $type: "fontFamily", $value: seed.fontFamily },
            mono: {
              $type: "fontFamily",
              $value: "'Fira Code', 'SFMono-Regular', Menlo, monospace",
            },
          },
          size: SHARED_TYPOGRAPHY_REST.size,
          weight: SHARED_TYPOGRAPHY_REST.weight,
          lineHeight: SHARED_TYPOGRAPHY_REST.lineHeight,
        },
      },
      modes: {
        dark: modeBlock(seed.dark, true),
        light: modeBlock(seed.light, false),
      },
    },
  } as ThemeDocument;
}

export const DEFAULT_THEME_DOCUMENTS: ThemeDocument[] =
  SEEDS.map(buildDocument);

export const THEME_PRESET_OPTIONS = DEFAULT_THEME_DOCUMENTS.map((doc) => ({
  value: doc.id,
  label: doc.name,
}));

export function getPresetById(id: string): ThemeDocument {
  return (
    DEFAULT_THEME_DOCUMENTS.find((doc) => doc.id === id) ??
    DEFAULT_THEME_DOCUMENTS[0]
  );
}

export function pickActiveDocument(
  themes: ThemeDocument[],
  activeThemeId: string | null,
): ThemeDocument {
  if (activeThemeId) {
    const found = themes.find((t) => t.id === activeThemeId);
    if (found) return found;
  }
  return themes[0] ?? DEFAULT_THEME_DOCUMENTS[0];
}