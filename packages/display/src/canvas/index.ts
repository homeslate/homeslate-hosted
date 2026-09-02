export const DISPLAY_CANVAS_ENTRY = '@homeslate/display/canvas';

export {
  DEFAULT_THEME_DOCUMENTS,
  THEME_PRESET_OPTIONS,
  getPresetById,
  pickActiveDocument,
} from './theme/defaults';
export { themeToVars, hexToRgb, getBackgroundStyle } from './theme/utils';
export { resolveDisplayThemeVars } from './theme/resolveDisplayThemeVars';
export { resolveTheme, ThemeResolutionError } from './theme/resolver';
export { mantineThemeFromResolved } from './theme/mantineBridge';
export {
  TAILWIND_COLOR_PALETTES,
  TAILWIND_COMPACT_COLOR_SWATCHES,
  TAILWIND_PALETTE_NAMES,
  TAILWIND_PALETTE_STEPS,
  tailwindPaletteToTokenGroup,
} from './theme/tailwindPalette';
export type { ResolvedTheme, ThemeOverride } from './theme/resolvedTypes';
export type { ColorMode } from '@homeslate/schema';
export {
  addWidget,
  applyWidgetLayouts,
  findAvailablePosition,
  patchView,
  patchViewNotes,
  patchWidgetConfig,
  removeWidget,
  replaceViewWidgets,
} from './patchDocument';
export { DocumentCanvas } from './DocumentCanvas';
export type { WidgetRegistryApi } from './WidgetWrapper';
export { WidgetWrapper } from './WidgetWrapper';
export { StickyNote } from './StickyNote';
export { BackgroundSlideshow } from './BackgroundSlideshow';
