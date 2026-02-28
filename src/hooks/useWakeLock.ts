import { useEffect } from 'react';

/**
 * Requests a screen wake lock so the display stays on while the app is visible.
 * Requires HTTPS (or localhost). Degrades silently if unavailable.
 * Wake locks are automatically released when the page is hidden and re-acquired
 * when it becomes visible again.
 */
export function useWakeLock() {
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    async function acquire() {
      if (!('wakeLock' in navigator)) return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch {
        // Unavailable (HTTP, permission denied, low battery policy, etc.)
      }
    }

    async function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        await acquire();
      }
    }

    acquire();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wakeLock?.release();
    };
  }, []);
}
