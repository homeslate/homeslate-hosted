import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import type { RemoteDisplay } from '../store/dashboardStore';

/**
 * On auth: loads all displays (with embedded configs) from /api/displays.
 * This hook is called once on sign-in; per-view auto-save is handled in ViewEditorPage.
 */
export function useConfigSync() {
  const { accessToken, isAuthenticated } = useAuth();
  const setDisplays = useDashboardStore((s) => s.setDisplays);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || loadedRef.current) return;
    loadedRef.current = true;

    fetch('/api/displays', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((rows: RemoteDisplay[]) => setDisplays(rows))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken]);

  // Reset so it reloads on next sign-in
  useEffect(() => {
    if (!isAuthenticated) loadedRef.current = false;
  }, [isAuthenticated]);
}
