export type ColorMode = 'dark' | 'light';

import type { ThemeDocument } from "../themes/themeDocumentValidation";

export type { ThemeDocument };

interface StateTriplet {
  bg: string;
  fg: string;
  border: string;
}

interface InteractiveTriplet extends StateTriplet {
  hoverBg: string;
  activeBg: string;
}

export interface ResolvedTheme {
  foundation: {
    color: {
      brand: Record<string, string>;
      neutral: Record<string, string>;
      success: Record<string, string>;
      warning: Record<string, string>;
      danger: Record<string, string>;
      info?: Record<string, string>;
    };
    spacing: Record<string, string>;
    radius: Record<string, string>;
    typography: {
      family: { base: string; mono: string; display?: string };
      size: Record<string, string>;
      weight: Record<string, number>;
      lineHeight: Record<string, number>;
    };
    shadow?: Record<string, string>;
    opacity?: Record<string, number>;
    zIndex?: Record<string, number>;
    motion?: {
      duration?: Record<string, string>;
      easing?: Record<string, string>;
    };
  };
  semantic: {
    surface: { canvas: string; sunken: string; card: string; overlay: string };
    text: { primary: string; muted: string; inverse: string; link: string };
    border: { subtle: string; default: string; strong: string };
    focus: { ring: string; offset?: string };
    status: {
      success: StateTriplet;
      warning: StateTriplet;
      danger: StateTriplet;
      info?: StateTriplet;
    };
    interactive: {
      primary: InteractiveTriplet;
      secondary: InteractiveTriplet;
      ghost: InteractiveTriplet;
    };
  };
  components?: {
    widget?: {
      background?: string;
      borderColor?: string;
      borderWidth?: string;
      radius?: string;
      shadow?: string;
      padding?: string;
    };
    toolbar?: {
      background?: string;
      text?: string;
      icon?: string;
      divider?: string;
      height?: string;
    };
    badge?: {
      background?: string;
      text?: string;
      radius?: string;
      paddingX?: string;
      paddingY?: string;
    };
    control?: {
      height?: string;
      radius?: string;
      borderColor?: string;
      background?: string;
      text?: string;
      placeholder?: string;
    };
  };
  meta: { id: string; name: string; mode: ColorMode };
}

type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/** Override applied during theme resolution. Foundation tokens are global and not overridable. */
export type ThemeOverride = DeepPartial<{
  semantic: ThemeDocument["tokens"]["modes"]["dark"]["semantic"];
  components: ThemeDocument["tokens"]["modes"]["dark"]["components"];
}>;
