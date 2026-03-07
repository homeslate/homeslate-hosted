import { MantineProvider, createTheme, ActionIcon, Tooltip, Loader, Center } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { lazy, Suspense } from 'react';
import { useWakeLock } from './hooks/useWakeLock';
import { useConfigSync } from './hooks/useConfigSync';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useDashboardStore } from './store/dashboardStore';
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
  const { selectedDisplayId, selectedViewId, previewDisplayId, closePreview } = useDashboardStore();
  useWakeLock();
  useConfigSync();

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
        <DisplayViewer displayId={previewDisplayId} />
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

  if (!selectedDisplayId) return <Suspense fallback={<PageLoader />}><DisplayListPage /></Suspense>;
  if (!selectedViewId) return <Suspense fallback={<PageLoader />}><DisplayDetailPage /></Suspense>;
  return <Suspense fallback={<PageLoader />}><ViewEditorPage /></Suspense>;
}

function App() {
  const colorScheme = useCurrentDisplayColorScheme();

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme={colorScheme}>
      <AuthProvider>
        <ThemeProvider>
          <AppInner />
        </ThemeProvider>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App;
