import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GoogleRuntimeProvider, type GoogleRuntime } from '@homeslate/widgets';

export function ReferenceGoogleRuntime({
  displayId,
  isPreview = false,
  children,
}: {
  displayId: string | null;
  isPreview?: boolean;
  children: ReactNode;
}) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await fetch('/api/google/session');
      const body = (await response.json()) as { accessToken?: string | null };
      const next = body.accessToken ?? null;
      setAccessToken(next);
      return next;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAccessToken();
  }, [refreshAccessToken]);

  const value = useMemo<GoogleRuntime>(
    () => ({
      accessToken,
      isAuthenticated: Boolean(accessToken),
      isLoading,
      signIn: () => {
        window.location.href = '/api/google/connect';
      },
      refreshAccessToken,
      displayId,
      isPreview,
      kioskFetchBaseUrl: '/api',
    }),
    [accessToken, displayId, isLoading, isPreview, refreshAccessToken],
  );

  return <GoogleRuntimeProvider value={value}>{children}</GoogleRuntimeProvider>;
}
