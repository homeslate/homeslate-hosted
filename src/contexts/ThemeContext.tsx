import { createContext, useContext } from 'react';
import type { DisplayTheme } from '../types/theme';
import { defaultTheme } from '../themes';
import { useDashboardStore } from '../store/dashboardStore';
import { themeToVars } from '../themes/utils';

interface ThemeContextValue {
  theme: DisplayTheme;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: defaultTheme });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { displays, selectedDisplayId } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const theme = display?.theme ?? defaultTheme;

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { themeToVars };
