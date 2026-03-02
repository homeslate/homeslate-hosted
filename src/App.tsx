import { MantineProvider, createTheme } from '@mantine/core';
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

const theme = createTheme({
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

function AppInner() {
  const { isAuthenticated } = useAuth();
  const { selectedDisplayId, selectedViewId } = useDashboardStore();
  useWakeLock();
  useConfigSync();

  // Display device mode: ?display=<uuid> → fullscreen viewer, no auth
  const displayParam = new URLSearchParams(window.location.search).get('display');
  if (displayParam) return <DisplayViewer displayId={displayParam} />;

  if (!isAuthenticated) return <AuthPage />;
  if (!selectedDisplayId) return <DisplayListPage />;
  if (!selectedViewId) return <DisplayDetailPage />;
  return <ViewEditorPage />;
}

function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AuthProvider>
        <ThemeProvider>
          <AppInner />
        </ThemeProvider>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App;
