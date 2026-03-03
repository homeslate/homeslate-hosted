import { MantineProvider, createTheme, ActionIcon, Tooltip } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useWakeLock } from './hooks/useWakeLock';
import { useConfigSync } from './hooks/useConfigSync';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useDashboardStore } from './store/dashboardStore';
import { DisplayViewer } from './components/DisplayViewer';
import { AuthPage } from './pages/AuthPage';
import { DisplayListPage } from './pages/DisplayListPage';
import { DisplayDetailPage } from './pages/DisplayDetailPage';
import { ViewEditorPage } from './pages/ViewEditorPage';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './App.css';

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

function useCurrentDisplayTheme() {
  const { selectedDisplayId, displays } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  return display?.theme;
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

  if (!isAuthenticated) return <AuthPage />;

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

  if (!selectedDisplayId) return <DisplayListPage />;
  if (!selectedViewId) return <DisplayDetailPage />;
  return <ViewEditorPage />;
}

function App() {
  const displayTheme = useCurrentDisplayTheme();
  const colorScheme = displayTheme?.isDark === false ? 'light' : 'dark';

  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme={colorScheme}>
      <AuthProvider>
        <ThemeProvider>
          <AppInner />
        </ThemeProvider>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App;
