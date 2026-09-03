import { createContext, useContext, type ReactNode } from 'react';
import { DISPLAY_SESSION_KEY, resolveDisplayId } from '../displayPersistence';

export { DISPLAY_SESSION_KEY };

interface DisplayContextValue {
  displayId: string;
  isPreview: boolean;
}

const DisplayContext = createContext<DisplayContextValue | null>(null);

export function DisplayProvider({
  displayId,
  isPreview = false,
  children,
}: {
  displayId: string;
  isPreview?: boolean;
  children: ReactNode;
}) {
  return (
    <DisplayContext.Provider value={{ displayId, isPreview }}>
      {children}
    </DisplayContext.Provider>
  );
}

export function useDisplayContext(): string | null {
  return useContext(DisplayContext)?.displayId ?? null;
}

/**
 * Read display ID from URL / session / standalone localStorage
 * (for when context isn't available). Use this as a fallback in widgets
 * so display mode is detected even with lazy loading.
 */
export function getDisplayIdFromWindow(): string | null {
  if (typeof window === 'undefined') return null;
  return resolveDisplayId();
}

/**
 * Display ID for the current device when in display/viewer mode.
 * Prefer context (DisplayProvider); fallback to URL / session / standalone local.
 */
export function useDisplayId(): string | null {
  const fromContext = useContext(DisplayContext)?.displayId;
  if (fromContext) return fromContext;
  return getDisplayIdFromWindow();
}

export function useIsPreviewDisplay(): boolean {
  return useContext(DisplayContext)?.isPreview ?? false;
}
