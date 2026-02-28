import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import type { RemoteConfig } from '../store/dashboardStore';

const POLL_INTERVAL_MS = 30_000;

export function useConfigSync() {
  const { user, accessToken, isAuthenticated } = useAuth();
  const loadFromRemote = useDashboardStore((s) => s.loadFromRemote);
  const isEditing = useDashboardStore((s) => s.isEditing);
  const wasEditingRef = useRef(false);

  // Load config from API when user signs in
  useEffect(() => {
    if (!user) return;
    fetch(`/api/display?id=${user.displayId}`)
      .then((r) => r.json())
      .then(({ config }: { config: RemoteConfig | null }) => {
        if (config) loadFromRemote(config);
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Poll every 30s when not editing (no auth needed — uses public display endpoint)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      // Skip poll while user is actively editing to avoid overwriting local changes
      if (useDashboardStore.getState().isEditing) return;
      fetch(`/api/display?id=${user.displayId}`)
        .then((r) => r.json())
        .then(({ config }: { config: RemoteConfig | null }) => {
          if (config) loadFromRemote(config);
        })
        .catch(console.error);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Save to API when the user finishes editing (isEditing flips true → false)
  useEffect(() => {
    if (wasEditingRef.current && !isEditing && isAuthenticated && accessToken) {
      const { layouts, activeLayoutId, rotationEnabled, rotationIntervalMs } =
        useDashboardStore.getState();
      fetch('/api/config', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ layouts, activeLayoutId, rotationEnabled, rotationIntervalMs }),
      }).catch(console.error);
    }
    wasEditingRef.current = isEditing;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);
}
