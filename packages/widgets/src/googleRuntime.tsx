import { createContext, useContext, type ReactNode } from 'react';

export type GoogleRuntime = {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => void;
  refreshAccessToken: () => Promise<string | null>;
  displayId: string | null;
  isPreview: boolean;
  kioskFetchBaseUrl: string;
};

export const DEFAULT_GOOGLE_RUNTIME: GoogleRuntime = {
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  signIn: () => {},
  refreshAccessToken: async () => null,
  displayId: null,
  isPreview: false,
  kioskFetchBaseUrl: '/api',
};

const GoogleRuntimeContext = createContext<GoogleRuntime | null>(null);

export function GoogleRuntimeProvider({
  value,
  children,
}: {
  value: GoogleRuntime;
  children: ReactNode;
}) {
  return <GoogleRuntimeContext.Provider value={value}>{children}</GoogleRuntimeContext.Provider>;
}

export function useGoogleRuntime(): GoogleRuntime {
  return useContext(GoogleRuntimeContext) ?? DEFAULT_GOOGLE_RUNTIME;
}
