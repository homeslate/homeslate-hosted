import type { ColorMode } from "../types/theme";
import type { ThemeDocument } from "./themeDocumentValidation";
import { pickActiveDocument } from "./defaults";
import { resolveTheme } from "./resolver";
import { themeToVars } from "./utils";

/**
 * Resolve CSS custom properties for the live display / preview viewer.
 * Always falls back to the bundled default theme when `themes` is empty,
 * matching ThemeContext behavior in the editor.
 */
export function resolveDisplayThemeVars(
  themes: ThemeDocument[] | undefined,
  activeThemeId: string | null | undefined,
  colorMode: ColorMode,
): Record<string, string> {
  const themeDoc = pickActiveDocument(themes ?? [], activeThemeId ?? null);
  return themeToVars(resolveTheme(themeDoc, colorMode));
}
