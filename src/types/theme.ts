/** Color properties that change between light and dark modes */
export interface ThemeModeColors {
  /** CSS background value — can be a gradient or solid color */
  background: string;
  /** Widget surface background (rgba) */
  surfaceBg: string;
  /** Widget surface border (rgba) */
  surfaceBorder: string;
  /** Primary text color */
  textPrimary: string;
  /** Muted / secondary text color */
  textMuted: string;
  /** Glow color (rgba) */
  glowColor: string;
}

export interface DisplayTheme {
  id: string;
  name: string;
  /** CSS background value — can be a gradient or solid color */
  background: string;
  /** Primary accent color (hex) */
  accentPrimary: string;
  /** Secondary accent color (hex) */
  accentSecondary: string;
  /** Widget surface background (rgba) */
  surfaceBg: string;
  /** Widget surface border (rgba) */
  surfaceBorder: string;
  /** Primary text color */
  textPrimary: string;
  /** Muted / secondary text color */
  textMuted: string;
  /** UI font family (CSS font-family string) */
  fontFamily: string;
  /** Whether to show glow effects on widgets */
  glowEnabled: boolean;
  /** Glow color (rgba) */
  glowColor: string;
  /** Light or dark theme (affects Mantine color scheme) */
  isDark: boolean;
  /**
   * Per-mode color overrides.
   * When present, `themeToVars` applies these instead of the top-level fields
   * when the active color mode matches.
   */
  darkColors?: ThemeModeColors;
  lightColors?: ThemeModeColors;
}

export type ColorMode = 'dark' | 'light';
