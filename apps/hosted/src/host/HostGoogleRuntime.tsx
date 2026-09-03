import type { ReactNode } from 'react';
import { GoogleRuntimeProvider, type GoogleRuntime } from '@homeslate/widgets';
import { useAuth } from '../contexts/AuthContext';
import { useDisplayId, useIsPreviewDisplay } from '../contexts/DisplayContext';

export function HostGoogleRuntime({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const displayId = useDisplayId();
  const isPreview = useIsPreviewDisplay();
  const value: GoogleRuntime = {
    accessToken: auth.accessToken,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    signIn: auth.signIn,
    refreshAccessToken: auth.refreshAccessToken,
    displayId,
    isPreview,
    kioskFetchBaseUrl: '/api',
  };
  return <GoogleRuntimeProvider value={value}>{children}</GoogleRuntimeProvider>;
}
