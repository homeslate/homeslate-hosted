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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);
  const [accessToken, setAccessToken] = useState<string | null>(readStoredToken);
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenClientRef = useRef<any>(null);

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
        callback: () => {}, // replaced per-request in signIn()
      });
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
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const fetchAndStoreUser = useCallback(
    async (token: string): Promise<AuthUser> => {
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
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
  useEffect(() => {
    if (accessToken && !user) {
      fetchAndStoreUser(accessToken).catch(clearSession);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(() => {
    if (!tokenClientRef.current) return;
    setIsLoading(true);
    tokenClientRef.current.callback = async (response: {
      access_token: string;
      expires_in: number;
      error?: string;
    }) => {
      if (response.error) {
        setIsLoading(false);
        return;
      }
      const token = response.access_token;
      const expiry = Date.now() + (response.expires_in ?? 3600) * 1000;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
      setAccessToken(token);
      try {
        await fetchAndStoreUser(token);
      } catch (err) {
        console.error('Failed to fetch user after sign-in:', err);
      } finally {
        setIsLoading(false);
      }
    };
    tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
  }, [fetchAndStoreUser]);

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
