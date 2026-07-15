export const DISPLAY_SESSION_KEY = 'kd_pending_display';
export const DISPLAY_LOCAL_KEY = 'kd_pinned_display';

/** Persist a display id for OAuth survival (session) and PWA relaunch (local). */
export function persistDisplayId(displayId: string): void {
  sessionStorage.setItem(DISPLAY_SESSION_KEY, displayId);
  localStorage.setItem(DISPLAY_LOCAL_KEY, displayId);
}

/** Clear the short-lived session copy without unpinning the installed display app. */
export function clearSessionDisplayId(): void {
  sessionStorage.removeItem(DISPLAY_SESSION_KEY);
}

/**
 * True when this window is an installed web app (Android Chrome / iOS home screen),
 * where the manifest start_url may strip ?display= on launch.
 */
export function isStandaloneDisplayApp(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

/**
 * Resolve which display id (if any) this window should open in viewer mode.
 * Priority: URL ?display= → sessionStorage → localStorage (standalone only).
 */
export function resolveDisplayId(search: string = window.location.search): string | null {
  const fromUrl = new URLSearchParams(search).get('display');
  if (fromUrl) return fromUrl;

  const fromSession = sessionStorage.getItem(DISPLAY_SESSION_KEY);
  if (fromSession) return fromSession;

  if (isStandaloneDisplayApp()) {
    return localStorage.getItem(DISPLAY_LOCAL_KEY);
  }

  return null;
}
