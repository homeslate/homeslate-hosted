import type { ColorMode } from '../types/theme';
import type { ThemeDocument } from './themeDocumentValidation';
import { hexToRgb } from './utils';

type TokenNode = Record<string, unknown>;

function readStringValue(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const o = node as TokenNode;
  if (typeof o.$value === 'string') return o.$value;
  return undefined;
}

function pickFirstString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    const v = readStringValue(c);
    if (v !== undefined) return v;
  }
  return undefined;
}

/**
 * Maps a validated theme document to the same CSS custom properties used by `themeToVars`,
 * so the theme editor preview matches dashboard chrome.
 */
export function themeDocumentToPreviewVars(doc: ThemeDocument, mode: ColorMode): Record<string, string> {
  const modeTokens = doc.tokens.modes[mode];
  const semantic = modeTokens.semantic;
  const components = modeTokens.components;
  const foundation = doc.tokens.foundation;

  const canvas = readStringValue(semantic.surface.canvas) ?? '#0a0a0f';
  const card = pickFirstString(
    components?.widget?.background,
    semantic.surface.card,
    semantic.surface.overlay
  ) ?? 'rgba(30, 30, 40, 0.6)';
  const border = pickFirstString(
    components?.widget?.borderColor,
    semantic.border.default,
    semantic.border.subtle
  ) ?? 'rgba(255, 255, 255, 0.08)';
  const text = readStringValue(semantic.text.primary) ?? '#e8e8f0';
  const muted = readStringValue(semantic.text.muted) ?? '#6c6c7e';
  const brand = foundation.color.brand as Record<string, unknown>;
  const accent =
    pickFirstString(
      brand['500'],
      semantic.interactive.primary.bg,
      semantic.text.link
    ) ?? '#6366f1';
  const accentSecondary = pickFirstString(brand['600'], semantic.interactive.primary.hoverBg) ?? accent;

  const rgb = hexToRgb(accent.startsWith('#') ? accent : `#${accent}`);
  const rgbStr = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '99, 102, 241';

  const glow =
    pickFirstString(semantic.focus.ring, semantic.interactive.primary.hoverBg) ?? 'rgba(99, 102, 241, 0.25)';

  const fontFamily = readStringValue(foundation.typography.family.base) ?? "'Inter', sans-serif";

  return {
    '--theme-bg': canvas,
    '--theme-accent': accent,
    '--theme-accent-rgb': rgbStr,
    '--theme-accent-secondary': accentSecondary,
    '--theme-surface-bg': card,
    '--theme-surface-border': border,
    '--theme-text': text,
    '--theme-text-muted': muted,
    '--theme-glow': glow,
    '--theme-font-family': fontFamily,
  };
}
