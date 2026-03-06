import type { CSSProperties } from 'react';
import type { DisplayTheme } from '../types/theme';

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

/** Convert a DisplayTheme to CSS custom properties */
export function themeToVars(theme: DisplayTheme): Record<string, string> {
  const rgb = hexToRgb(theme.accentPrimary);
  const rgbStr = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '99, 102, 241';
  return {
    '--theme-bg': theme.background,
    '--theme-accent': theme.accentPrimary,
    '--theme-accent-rgb': rgbStr,
    '--theme-accent-secondary': theme.accentSecondary,
    '--theme-surface-bg': theme.surfaceBg,
    '--theme-surface-border': theme.surfaceBorder,
    '--theme-text': theme.textPrimary,
    '--theme-text-muted': theme.textMuted,
    '--theme-glow': theme.glowEnabled ? theme.glowColor : 'transparent',
    '--theme-font-family': theme.fontFamily,
  };
}
