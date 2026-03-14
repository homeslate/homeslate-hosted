import { MantineProvider, createTheme, ActionIcon, Tooltip, Loader, Center } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useWakeLock } from './hooks/useWakeLock';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useDashboardStore } from './store/dashboardStore';
import { ManagementLayout } from './components/ManagementLayout';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './App.css';

// Lazy-load heavy page bundles so they are only fetched when first needed.
// DisplayViewer is used on the always-on tablet so keep it eager to avoid
// a loading flash on every hard refresh of the display URL.
import { DisplayViewer } from './components/DisplayViewer';
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const DisplayListPage = lazy(() => import('./pages/DisplayListPage').then((m) => ({ default: m.DisplayListPage })));
const DisplayDetailPage = lazy(() => import('./pages/DisplayDetailPage').then((m) => ({ default: m.DisplayDetailPage })));
const ViewEditorPage = lazy(() => import('./pages/ViewEditorPage').then((m) => ({ default: m.ViewEditorPage })));
const PairPage = lazy(() => import('./pages/PairPage').then((m) => ({ default: m.PairPage })));

function PageLoader() {
  return (
    <Center style={{ width: '100%', height: '100%', minHeight: '60vh' }}>
      <Loader size="lg" />
    </Center>
  );
}

const mantineTheme = createTheme({
  primaryColor: 'indigo',
  fontFamily: '"Outfit", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  headings: {
    fontFamily: '"Outfit", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  colors: {
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5c5f66',
      '#373A40',
      '#2C2E33',
      '#25262b',
      '#1A1B1E',
      '#141517',
      '#101113',
    ],
  },
  defaultRadius: 'md',
  components: {
    Button: { defaultProps: { radius: 'md' } },
    Paper:  { defaultProps: { radius: 'md' } },
  },
});

function useCurrentDisplayColorScheme(): 'light' | 'dark' {
  const { selectedDisplayId, displays } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  // colorMode overrides the theme's isDark default
  if (display?.colorMode) return display.colorMode;
  return display?.theme?.isDark === false ? 'light' : 'dark';
}

// If the URL has ?display=<uuid>, persist it so it survives OAuth redirects.
// We do this at module load time (before any component mounts) so we catch
// the very first navigation, including cases where the browser reloads after
// a Google OAuth redirect flow and the query string has been stripped.
const DISPLAY_SESSION_KEY = 'kd_pending_display';
const _initialDisplayParam = new URLSearchParams(window.location.search).get('display');
if (_initialDisplayParam) {
  sessionStorage.setItem(DISPLAY_SESSION_KEY, _initialDisplayParam);
}

function AppInner() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const { previewDisplayId, closePreview } = useDashboardStore();
  useWakeLock();

  // Unauthenticated pairing page for headless displays (no keyboard/mouse).
  if (pathname === '/pair') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PairPage />
      </Suspense>
    );
  }

  // Display device mode: ?display=<uuid> → fullscreen viewer, no auth needed.
  // Also check sessionStorage so we survive OAuth redirects that strip query params
  // (e.g. on Android Chrome where the Google consent flow can reload the page).
  const urlDisplayParam = new URLSearchParams(window.location.search).get('display');
  const displayParam = urlDisplayParam ?? sessionStorage.getItem(DISPLAY_SESSION_KEY);
  if (displayParam) return <DisplayViewer displayId={displayParam} />;

  // No display param — clear any stale pending display so the management UI
  // is reachable if the user navigates to the root URL without the parameter.
  sessionStorage.removeItem(DISPLAY_SESSION_KEY);

  if (!isAuthenticated) return <Suspense fallback={<PageLoader />}><AuthPage /></Suspense>;

  // In-app preview mode: render the viewer with an exit button overlay
  if (previewDisplayId) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <DisplayViewer displayId={previewDisplayId} isPreview />
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999 }}>
          <Tooltip label="Exit preview" position="left" withArrow>
            <ActionIcon
              size="lg"
              radius="xl"
              variant="filled"
              color="dark"
              onClick={closePreview}
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
            >
              <IconX size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/displays" replace />} />
      <Route path="/displays" element={<ManagementLayout />}>
        <Route index element={<Suspense fallback={<PageLoader />}><DisplayListPage /></Suspense>} />
        <Route path=":displayId" element={<Suspense fallback={<PageLoader />}><DisplayDetailPage /></Suspense>} />
        <Route path=":displayId/views/:viewId" element={<Suspense fallback={<PageLoader />}><ViewEditorPage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/displays" replace />} />
    </Routes>
  );
}

function App() {
  const colorScheme = useCurrentDisplayColorScheme();

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={colorScheme}>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <AppInner />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App;
