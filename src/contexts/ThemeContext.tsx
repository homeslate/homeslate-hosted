import { createContext, useContext } from 'react';
import type { ColorMode, DisplayTheme } from '../types/theme';
import { defaultTheme } from '../themes';
import { useDashboardStore } from '../store/dashboardStore';
import { themeToVars, getBackgroundStyle } from '../themes/utils';

interface ThemeContextValue {
  theme: DisplayTheme;
  /** Active color mode for the current display */
  colorMode: ColorMode;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  colorMode: 'dark',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { displays, selectedDisplayId } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const theme = display?.theme ?? defaultTheme;

  // Effective color mode: explicit per-display override > theme's isDark default
  const colorMode: ColorMode =
    display?.colorMode ?? (theme.isDark === false ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, colorMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { themeToVars, getBackgroundStyle };
