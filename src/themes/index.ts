export {
  DEFAULT_THEME_DOCUMENTS,
  THEME_PRESET_OPTIONS,
  getPresetById,
  pickActiveDocument,
} from "./defaults";
export { themeToVars, hexToRgb, getBackgroundStyle } from "./utils";
export { resolveTheme, ThemeResolutionError } from "./resolver";
export { mantineThemeFromResolved } from "./mantineBridge";
export {
  validateThemeDocument,
  isThemeDocumentCandidate,
} from "./themeDocumentValidation";
export type { ThemeDocument } from "./themeDocumentValidation";

import { DEFAULT_THEME_DOCUMENTS } from "./defaults";
export const defaultThemeDocument = DEFAULT_THEME_DOCUMENTS[0];