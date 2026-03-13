import { createContext, useContext, type ReactNode } from 'react';

export const DISPLAY_SESSION_KEY = 'kd_pending_display';

const DisplayContext = createContext<string | null>(null);

export function DisplayProvider({ displayId, children }: { displayId: string; children: ReactNode }) {
  return (
    <DisplayContext.Provider value={displayId}>
      {children}
    </DisplayContext.Provider>
  );
}

export function useDisplayContext(): string | null {
  return useContext(DisplayContext);
}

/**
 * Read display ID from URL or sessionStorage (for when context isn't available).
 * Use this as a fallback in widgets so display mode is detected even with lazy loading.
 */
export function getDisplayIdFromWindow(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    new URLSearchParams(window.location.search).get('display') ||
    sessionStorage.getItem(DISPLAY_SESSION_KEY)
  );
}

/**
 * Display ID for the current device when in display/viewer mode.
 * Prefer context (DisplayProvider); fallback to URL or sessionStorage.
 */
export function useDisplayId(): string | null {
  const fromContext = useContext(DisplayContext);
  if (fromContext) return fromContext;
  return getDisplayIdFromWindow();
}
