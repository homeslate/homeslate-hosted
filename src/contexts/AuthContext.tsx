import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

// Scopes: identity info + Google Calendar + Google Photos Picker access
const SCOPES =
  'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

// Reuse the same storage keys as the legacy calendar service so the
// Calendar widget picks up the shared token without any changes.
const TOKEN_KEY = 'gcal_access_token';
const TOKEN_EXPIRY_KEY = 'gcal_token_expiry';
const USER_KEY = 'auth_user';
const REFRESH_TOKEN_KEY = 'gcal_refresh_token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: () => void;
  signOut: () => void;
  /** Refresh the access token using the stored refresh token. Returns new token or null. */
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface GoogleCodeClient {
  requestCode: (config?: { prompt?: string }) => void;
}

function readStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (token && expiry && Date.now() < parseInt(expiry, 10)) return token;
  return null;
}

function readStoredUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as AuthUser & { displayId?: string };
    // Strip legacy displayId if present
    const { id, email, name, picture } = parsed;
    return { id, email, name, picture };
  } catch {
    return null;
  }
}

// How many milliseconds before expiry to trigger a silent refresh.
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);
  const [accessToken, setAccessToken] = useState<string | null>(readStoredToken);
  const [isLoading, setIsLoading] = useState(false);

  const codeClientRef = useRef<GoogleCodeClient | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedTokenRef = useRef<string | null>(null);

  /**
   * Store a fresh token + schedule the next silent refresh.
   */
  const storeToken = useCallback((token: string, expiresIn: number) => {
    const expiry = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
    setAccessToken(token);

    const msUntilRefresh = Math.max(0, expiresIn * 1000 - REFRESH_BEFORE_EXPIRY_MS);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      silentRefresh();
    }, msUntilRefresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    try {
      const res = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        console.warn('Token refresh failed:', res.status);
        if (res.status === 401) {
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        return null;
      }
      const data = await res.json() as { access_token: string; expires_in: number };
      storeToken(data.access_token, data.expires_in);
      return data.access_token;
    } catch (err) {
      console.warn('Token refresh error:', err);
      return null;
    }
  }, [storeToken]);

  /** Refresh access token server-side using the stored refresh token. */
  const silentRefresh = useCallback(async () => {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      console.warn('Server-side token refresh failed; owner must sign in again');
    }
  }, [refreshAccessToken]);

  const scheduleRefreshFromStorage = useCallback(() => {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!expiry || !token) return;

    const msRemaining = parseInt(expiry, 10) - Date.now();
    const msUntilRefresh = Math.max(0, msRemaining - REFRESH_BEFORE_EXPIRY_MS);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      silentRefresh();
    }, msUntilRefresh);
  }, [silentRefresh]);

  // Schedule silent server-side token refresh from stored credentials (no Google popup).
  useEffect(() => {
    scheduleRefreshFromStorage();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefreshFromStorage]);

  const clearSession = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    syncedTokenRef.current = null;
  }, []);

  const fetchAndStoreUser = useCallback(
    async (token: string, refreshToken?: string): Promise<AuthUser> => {
      const refreshForServer =
        refreshToken ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null);
      const res = await fetch('/api/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(refreshForServer ? { 'X-Refresh-Token': refreshForServer } : {}),
        },
      });
      if (!res.ok) throw new Error('Failed to fetch user');
      const data = await res.json() as {
        id: string;
        email: string;
        name: string;
        picture: string;
      };
      const authUser: AuthUser = {
        id: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
      setUser(authUser);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
      return authUser;
    },
    []
  );

  // On mount: restore session from stored tokens, refreshing if the access token expired.
  useEffect(() => {
    const token = readStoredToken();
    const storedUser = readStoredUser();
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (token && storedUser) return;

    if (token && !storedUser) {
      fetchAndStoreUser(token).catch(clearSession);
      return;
    }

    if (storedRefresh) {
      refreshAccessToken()
        .then((newToken) => {
          if (newToken) return fetchAndStoreUser(newToken);
          // Only sign out when the refresh token was rejected (removed above on 401).
          if (!localStorage.getItem(REFRESH_TOKEN_KEY)) {
            throw new Error('Token refresh failed');
          }
        })
        .catch(clearSession);
      return;
    }

    if (storedUser || token) {
      clearSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep backend token state fresh for display-calendar usage (owner/collaborator).
  useEffect(() => {
    if (!accessToken) return;
    if (syncedTokenRef.current === accessToken) return;

    void fetchAndStoreUser(accessToken)
      .then(() => {
        syncedTokenRef.current = accessToken;
      })
      .catch((err) => {
        console.warn('Failed to sync auth session to backend:', err);
      });
  }, [accessToken, fetchAndStoreUser]);

  const signIn = useCallback(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
    if (!clientId) return;

    setIsLoading(true);

    const runSignIn = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (!oauth2) {
        setIsLoading(false);
        return;
      }

      const client = oauth2.initCodeClient({
        client_id: clientId,
        scope: SCOPES,
        ux_mode: 'popup',
        callback: async (response) => {
          if (response.error) {
            console.error('Google sign-in failed:', response.error, response.error_description);
            setIsLoading(false);
            return;
          }
          if (!response.code) {
            setIsLoading(false);
            return;
          }

          try {
            const res = await fetch('/api/exchange-code', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XmlHttpRequest',
              },
              body: JSON.stringify({
                code: response.code,
                redirect_uri: window.location.origin,
              }),
            });

            if (!res.ok) {
              throw new Error('Failed to exchange authorization code');
            }

            const data = await res.json() as {
              access_token: string;
              expires_in: number;
              refresh_token?: string;
              user: AuthUser;
            };

            if (data.refresh_token) {
              localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
            } else {
              console.warn('No refresh token returned; calendar on displays may stop working after access token expiry');
            }

            storeToken(data.access_token, data.expires_in ?? 3600);
            setUser(data.user);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            syncedTokenRef.current = data.access_token;
          } catch (err) {
            console.error('Failed to complete sign-in:', err);
          } finally {
            setIsLoading(false);
          }
        },
        error_callback: (error) => {
          console.warn('Google sign-in error:', error);
          setIsLoading(false);
        },
      });

      codeClientRef.current = client;
      client.requestCode({ prompt: 'consent' });
    };

    if (window.google?.accounts?.oauth2) {
      runSignIn();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setTimeout(runSignIn, 100);
    script.onerror = () => {
      console.error('Failed to load Google Identity Services');
      setIsLoading(false);
    };
    document.head.appendChild(script);
  }, [storeToken]);

  // Do not call Google's token revoke here: revocation invalidates the refresh
  // token for this OAuth client, which breaks server-side calendar fetch for
  // registered displays (`/api/display-calendar`) even though those devices
  // never use this browser session. Users can revoke the app in Google Account
  // settings if they want to disconnect entirely.
  const signOut = useCallback(() => {
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user && !!accessToken,
        signIn,
        signOut,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
