import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ColorMode, ThemeDocument } from '@homeslate/schema';
import {
  DEFAULT_THEME_DOCUMENTS,
  getBackgroundStyle,
  pickActiveDocument,
  resolveTheme,
  themeToVars,
  type ResolvedTheme,
} from '@homeslate/display/canvas';
import { useDashboardStore } from '../store/dashboardStore';

const defaultThemeDocument = DEFAULT_THEME_DOCUMENTS[0];

interface ThemeContextValue {
  document: ThemeDocument;
  resolved: ResolvedTheme;
  vars: Record<string, string>;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
}

const initialResolved = resolveTheme(defaultThemeDocument, 'dark');

const ThemeContext = createContext<ThemeContextValue>({
  document: defaultThemeDocument,
  resolved: initialResolved,
  vars: themeToVars(initialResolved),
  colorMode: 'dark',
  setColorMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const displays = useDashboardStore((state) => state.displays);
  const selectedDisplayId = useDashboardStore((state) => state.selectedDisplayId);
  const storeSetColorMode = useDashboardStore((state) => state.setColorMode);

  const display = displays.find((d) => d.id === selectedDisplayId);

  const document = useMemo(() => {
    const themes = display?.themes ?? [];
    const activeThemeId = display?.activeThemeId ?? null;
    return pickActiveDocument(themes, activeThemeId);
  }, [display?.themes, display?.activeThemeId]);

  const colorMode: ColorMode = display?.colorMode ?? 'dark';

  const resolved = useMemo(
    () => resolveTheme(document, colorMode),
    [document, colorMode],
  );

  const vars = useMemo(() => themeToVars(resolved), [resolved]);

  const setColorMode = useCallback(
    (mode: ColorMode) => {
      if (selectedDisplayId) storeSetColorMode(selectedDisplayId, mode);
    },
    [selectedDisplayId, storeSetColorMode],
  );

  return (
    <ThemeContext.Provider
      value={{ document, resolved, vars, colorMode, setColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { themeToVars, getBackgroundStyle };