import type { DisplayTheme } from '../types/theme';
import { PRESET_THEMES } from './presets';
import type { ThemeDocument } from './themeDocumentValidation';

const SPACING = {
  '0': { $type: 'dimension', $value: '0px' },
  '1': { $type: 'dimension', $value: '4px' },
  '2': { $type: 'dimension', $value: '8px' },
  '3': { $type: 'dimension', $value: '12px' },
  '4': { $type: 'dimension', $value: '16px' },
  '5': { $type: 'dimension', $value: '20px' },
  '6': { $type: 'dimension', $value: '24px' },
  '8': { $type: 'dimension', $value: '32px' },
  '10': { $type: 'dimension', $value: '40px' },
  '12': { $type: 'dimension', $value: '48px' },
  '16': { $type: 'dimension', $value: '64px' },
} as const;

const RADIUS = {
  none: { $type: 'dimension', $value: '0px' },
  sm: { $type: 'dimension', $value: '6px' },
  md: { $type: 'dimension', $value: '10px' },
  lg: { $type: 'dimension', $value: '14px' },
  xl: { $type: 'dimension', $value: '18px' },
  full: { $type: 'dimension', $value: '9999px' },
} as const;

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function color(value: string) {
  return { $type: 'color' as const, $value: value };
}

function dimension(value: string) {
  return { $type: 'dimension' as const, $value: value };
}

function weight(value: number) {
  return { $type: 'fontWeight' as const, $value: value };
}

function fontFamily(value: string) {
  return { $type: 'fontFamily' as const, $value: value };
}

function num(value: number) {
  return { $type: 'number' as const, $value: value };
}

function modeFromPreset(theme: DisplayTheme, mode: 'dark' | 'light') {
  const base = {
    background: theme.background,
    surfaceBg: theme.surfaceBg,
    surfaceBorder: theme.surfaceBorder,
    textPrimary: theme.textPrimary,
    textMuted: theme.textMuted,
    glowColor: theme.glowColor,
  };
  const modeColors = mode === 'dark' ? theme.darkColors : theme.lightColors;
  const colors = modeColors ?? base;

  return {
    semantic: {
      surface: {
        canvas: color(colors.background),
        sunken: color(colors.background),
        card: color(colors.surfaceBg),
        overlay: color(colors.surfaceBg),
      },
      text: {
        primary: color(colors.textPrimary),
        muted: color(colors.textMuted),
        inverse: color(mode === 'dark' ? '#101828' : '#f8fafc'),
        link: color(theme.accentPrimary),
      },
      border: {
        subtle: color(colors.surfaceBorder),
        default: color(colors.surfaceBorder),
        strong: color(theme.accentPrimary),
      },
      focus: {
        ring: color(theme.accentPrimary),
        offset: color(colors.background),
      },
      status: {
        success: { bg: color('#166534'), fg: color('#dcfce7'), border: color('#22c55e') },
        warning: { bg: color('#92400e'), fg: color('#fef3c7'), border: color('#f59e0b') },
        danger: { bg: color('#991b1b'), fg: color('#fee2e2'), border: color('#ef4444') },
      },
      interactive: {
        primary: {
          bg: color(theme.accentPrimary),
          fg: color('#ffffff'),
          border: color(theme.accentPrimary),
          hoverBg: color(theme.accentSecondary),
          activeBg: color(theme.accentSecondary),
        },
        secondary: {
          bg: color(colors.surfaceBg),
          fg: color(colors.textPrimary),
          border: color(colors.surfaceBorder),
          hoverBg: color(colors.surfaceBg),
          activeBg: color(colors.surfaceBg),
        },
        ghost: {
          bg: color('transparent'),
          fg: color(colors.textPrimary),
          border: color('transparent'),
          hoverBg: color(colors.surfaceBg),
          activeBg: color(colors.surfaceBg),
        },
      },
    },
    components: {
      widget: {
        background: color(colors.surfaceBg),
        borderColor: color(colors.surfaceBorder),
        borderWidth: dimension('1px'),
        radius: dimension('12px'),
        padding: dimension('12px'),
      },
      toolbar: {
        background: color(colors.surfaceBg),
        text: color(colors.textPrimary),
        icon: color(colors.textMuted),
        divider: color(colors.surfaceBorder),
        height: dimension('56px'),
      },
      badge: {
        background: color(theme.accentPrimary),
        text: color('#ffffff'),
        radius: dimension('9999px'),
        paddingX: dimension('10px'),
        paddingY: dimension('4px'),
      },
      control: {
        height: dimension('36px'),
        radius: dimension('8px'),
        borderColor: color(colors.surfaceBorder),
        background: color(colors.surfaceBg),
        text: color(colors.textPrimary),
        placeholder: color(colors.textMuted),
      },
    },
  };
}

export function createThemeDocumentFromPreset(preset: DisplayTheme, name?: string): ThemeDocument {
  const timestamp = nowIso();
  const themeName = name?.trim() || `${preset.name} Theme`;
  const idBase = slugify(themeName) || `theme-${Date.now()}`;

  return {
    $schema: 'https://homeslate.app/schemas/theme-document.schema.json',
    id: idBase,
    name: themeName,
    description: `Generated from ${preset.name} preset`,
    version: 1,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    tokens: {
      foundation: {
        color: {
          brand: {
            '500': color(preset.accentPrimary),
            '600': color(preset.accentSecondary),
          },
          neutral: {
            '100': color('#f3f4f6'),
            '500': color('#6b7280'),
            '900': color('#111827'),
          },
          success: {
            '500': color('#22c55e'),
          },
          warning: {
            '500': color('#f59e0b'),
          },
          danger: {
            '500': color('#ef4444'),
          },
          info: {
            '500': color('#0ea5e9'),
          },
        },
        spacing: SPACING,
        radius: RADIUS,
        typography: {
          family: {
            base: fontFamily(preset.fontFamily),
            mono: fontFamily("'Fira Code', 'SFMono-Regular', Menlo, monospace"),
          },
          size: {
            xs: dimension('12px'),
            sm: dimension('14px'),
            md: dimension('16px'),
            lg: dimension('18px'),
            xl: dimension('20px'),
            '2xl': dimension('24px'),
          },
          weight: {
            regular: weight(400),
            medium: weight(500),
            semibold: weight(600),
            bold: weight(700),
          },
          lineHeight: {
            tight: num(1.2),
            normal: num(1.5),
            relaxed: num(1.75),
          },
        },
      },
      modes: {
        dark: modeFromPreset(preset, 'dark'),
        light: modeFromPreset(preset, 'light'),
      },
    },
  };
}

export const THEME_PRESET_OPTIONS = PRESET_THEMES.map((preset) => ({
  value: preset.id,
  label: preset.name,
}));

export function getPresetById(id: string): DisplayTheme {
  return PRESET_THEMES.find((preset) => preset.id === id) ?? PRESET_THEMES[0];
}
