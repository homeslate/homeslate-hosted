export {
  DEFAULT_THEME_DOCUMENTS,
  THEME_PRESET_OPTIONS,
  getPresetById,
  pickActiveDocument,
  themeToVars,
  hexToRgb,
  getBackgroundStyle,
  resolveDisplayThemeVars,
  resolveTheme,
  ThemeResolutionError,
  mantineThemeFromResolved,
} from "@homeslate/display/canvas";
export {
  validateThemeDocument,
  isThemeDocumentCandidate,
} from "./themeDocumentValidation";
export type { ThemeDocument } from "./themeDocumentValidation";

import { DEFAULT_THEME_DOCUMENTS } from "@homeslate/display/canvas";
export const defaultThemeDocument = DEFAULT_THEME_DOCUMENTS[0];
