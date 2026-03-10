import { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import type { RemoteDisplay } from '../store/dashboardStore';

/**
 * Layout for the management UI. Fetches displays from the API and syncs URL
 * params to the dashboard store so navigation and refresh work correctly.
 */
export function ManagementLayout() {
  const { accessToken } = useAuth();
  const { displayId, viewId } = useParams<{ displayId: string; viewId: string }>();
  const navigate = useNavigate();
  const { displays, setDisplays, selectDisplay, selectView } = useDashboardStore();

  // Fetch displays when authenticated
  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/displays', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((rows: RemoteDisplay[]) => setDisplays(rows))
      .catch(console.error);
  }, [accessToken, setDisplays]);

  // Sync URL params to store and validate
  useEffect(() => {
    if (!displayId) {
      selectDisplay(null);
      selectView(null);
      return;
    }

    selectDisplay(displayId);

    if (viewId) {
      const display = displays.find((d) => d.id === displayId);
      const layoutExists = display?.layouts.some((l) => l.id === viewId);
      if (display && !layoutExists) {
        // View doesn't exist, redirect to display detail
        navigate(`/displays/${displayId}`, { replace: true });
        selectView(null);
      } else {
        selectView(viewId);
      }
    } else {
      selectView(null);
    }
  }, [displayId, viewId, displays, selectDisplay, selectView, navigate]);

  // Redirect if displayId is invalid (display not in list after fetch)
  useEffect(() => {
    if (!displayId || displays.length === 0) return;
    const display = displays.find((d) => d.id === displayId);
    if (!display) {
      navigate('/displays', { replace: true });
    }
  }, [displayId, displays, navigate]);

  // Show loader while displays are loading and we need display data
  const needsDisplay = !!displayId;
  const isLoading = needsDisplay && displays.length === 0;
  const display = displays.find((d) => d.id === displayId);
  const displayValid = !needsDisplay || !!display;

  if (isLoading || (needsDisplay && !displayValid)) {
    return (
      <Center style={{ width: '100%', height: '100%', minHeight: '60vh' }}>
        <Loader size="lg" />
      </Center>
    );
  }

  return <Outlet />;
}
