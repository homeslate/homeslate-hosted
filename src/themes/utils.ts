import type { CSSProperties } from 'react';
import type { ColorMode, DisplayTheme, ThemeModeColors } from '../types/theme';

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

interface BackgroundImageConfig {
  backgroundImage?: string;
  backgroundImageSize?: 'cover' | 'contain' | 'tile';
  backgroundOverlayOpacity?: number;
}

/**
 * Returns inline background style when a background image is set on a view layout.
 * Layers a semi-transparent dark overlay on top of the image so text stays readable.
 * Returns an empty object when there is no background image (CSS class handles it).
 */
export function getBackgroundStyle(config: BackgroundImageConfig): CSSProperties {
  if (!config.backgroundImage) return {};
  const opacity = config.backgroundOverlayOpacity ?? 0.5;
  const size = config.backgroundImageSize === 'tile' ? 'auto' : (config.backgroundImageSize ?? 'cover');
  const repeat = config.backgroundImageSize === 'tile' ? 'repeat' : 'no-repeat';
  return {
    background: `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity})), url(${config.backgroundImage}) center/${size} ${repeat}`,
  };
}

/**
 * Resolve the effective mode colors for a theme given a color mode.
 *
 * Priority order:
 * 1. If the theme has a matching `darkColors` / `lightColors` variant, use it.
 * 2. Fall back to the top-level theme fields.
 */
function resolveModeColors(theme: DisplayTheme, mode: ColorMode): ThemeModeColors {
  const variant = mode === 'dark' ? theme.darkColors : theme.lightColors;
  return {
    background: variant?.background ?? theme.background,
    surfaceBg: variant?.surfaceBg ?? theme.surfaceBg,
    surfaceBorder: variant?.surfaceBorder ?? theme.surfaceBorder,
    textPrimary: variant?.textPrimary ?? theme.textPrimary,
    textMuted: variant?.textMuted ?? theme.textMuted,
    glowColor: variant?.glowColor ?? theme.glowColor,
  };
}

/** Convert a DisplayTheme to CSS custom properties, honouring the active color mode */
export function themeToVars(theme: DisplayTheme, mode?: ColorMode): Record<string, string> {
  // Determine effective mode: explicit arg > theme.isDark > default dark
  const effectiveMode: ColorMode = mode ?? (theme.isDark === false ? 'light' : 'dark');
  const colors = resolveModeColors(theme, effectiveMode);

  const rgb = hexToRgb(theme.accentPrimary);
  const rgbStr = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '99, 102, 241';
  return {
    '--theme-bg': colors.background,
    '--theme-accent': theme.accentPrimary,
    '--theme-accent-rgb': rgbStr,
    '--theme-accent-secondary': theme.accentSecondary,
    '--theme-surface-bg': colors.surfaceBg,
    '--theme-surface-border': colors.surfaceBorder,
    '--theme-text': colors.textPrimary,
    '--theme-text-muted': colors.textMuted,
    '--theme-glow': theme.glowEnabled ? colors.glowColor : 'transparent',
    '--theme-font-family': theme.fontFamily,
  };
}
