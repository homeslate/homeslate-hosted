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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenClientRef = useRef<any>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Store a fresh token + schedule the next silent refresh.
   * Called both from signIn() and from the silent-refresh callback.
   */
  const storeToken = useCallback((token: string, expiresIn: number) => {
    const expiry = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
    setAccessToken(token);

    // Schedule next refresh REFRESH_BEFORE_EXPIRY_MS before the token expires.
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

  /**
   * Request a new access token using server-side refresh.
   * This works without requiring Google Identity Services or browser session.
   */
  const silentRefresh = useCallback(async () => {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      console.warn('Server-side token refresh failed, will try GIS fallback');
      if (!tokenClientRef.current) return;
      tokenClientRef.current.callback = (response: {
        access_token: string;
        expires_in: number;
        error?: string;
      }) => {
        if (response.error) {
          console.warn('GIS silent token refresh failed:', response.error);
          return;
        }
        storeToken(response.access_token, response.expires_in ?? 3600);
      };
      tokenClientRef.current.requestAccessToken({ prompt: '' });
    }
  }, [refreshAccessToken, storeToken]);

  // Load Google Identity Services and initialise the token client
  useEffect(() => {
    const init = () => {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
      if (!clientId) return;
      tokenClientRef.current = (
        window as typeof window & { google: typeof google }
      ).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        // @ts-expect-error - access_type is a valid Google OAuth option
        access_type: 'offline',
        callback: () => {}, // replaced per-request in signIn() / silentRefresh()
      });

      // If we already have a stored token, schedule a refresh based on the
      // remaining lifetime. If it's already close to expiry or expired, refresh now.
      const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (expiry && localStorage.getItem(TOKEN_KEY)) {
        const msRemaining = parseInt(expiry, 10) - Date.now();
        const msUntilRefresh = Math.max(0, msRemaining - REFRESH_BEFORE_EXPIRY_MS);
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          silentRefresh();
        }, msUntilRefresh);
      }
    };

    if (
      typeof window !== 'undefined' &&
      (window as typeof window & { google?: unknown }).google
    ) {
      init();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setTimeout(init, 100);
    document.head.appendChild(script);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, []);

  const fetchAndStoreUser = useCallback(
    async (token: string, refreshToken?: string): Promise<AuthUser> => {
      const res = await fetch('/api/me', {
        headers: { 
          Authorization: `Bearer ${token}`,
          ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
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

  // On mount: if we have a stored token but no user, re-validate it
  // If token is expired, try to refresh it first
  useEffect(() => {
    if (accessToken && !user) {
      const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
      const isExpired = !expiry || Date.now() >= parseInt(expiry, 10);
      
      if (isExpired) {
        refreshAccessToken()
          .then((newToken) => {
            if (newToken) {
              return fetchAndStoreUser(newToken);
            }
            throw new Error('Token refresh failed');
          })
          .catch(clearSession);
      } else {
        fetchAndStoreUser(accessToken).catch(clearSession);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(() => {
    if (!tokenClientRef.current) return;
    setIsLoading(true);
    tokenClientRef.current.callback = async (response: {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      error?: string;
    }) => {
      if (response.error) {
        setIsLoading(false);
        return;
      }
      const token = response.access_token;
      if (response.refresh_token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
      }
      storeToken(token, response.expires_in ?? 3600);
      try {
        await fetchAndStoreUser(token, response.refresh_token);
      } catch (err) {
        console.error('Failed to fetch user after sign-in:', err);
      } finally {
        setIsLoading(false);
      }
    };
    tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
  }, [fetchAndStoreUser, storeToken]);

  const signOut = useCallback(() => {
    if (accessToken && (window as typeof window & { google?: typeof google }).google) {
      window.google?.accounts.oauth2.revoke(accessToken, () => {});
    }
    clearSession();
  }, [accessToken, clearSession]);

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
