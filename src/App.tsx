import { useRef } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { Dashboard, Header, AddWidgetPanel, ViewIndicator } from './components';
import { useDashboardStore } from './store/dashboardStore';
import { useWakeLock } from './hooks/useWakeLock';
import { useViewRotation } from './hooks/useViewRotation';
import { useConfigSync } from './hooks/useConfigSync';
import { AuthProvider } from './contexts/AuthContext';
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
  const { isEditing, layouts, navigateToView } = useDashboardStore();
  useWakeLock();
  const { resetTimer } = useViewRotation();
  useConfigSync();

  // ── Swipe to change views ──
  const swipeStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (isEditing || layouts.length <= 1) return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (isEditing || layouts.length <= 1) return;
    const dx = e.clientX - swipeStart.current.x;
    const dy = e.clientY - swipeStart.current.y;
    // Must be predominantly horizontal and exceed 80px
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      navigateToView(dx < 0 ? 'next' : 'prev');
      resetTimer(); // restart auto-rotation countdown after manual swipe
    }
  };

  return (
    <div className="app">
      <Header />
      <main
        className="main"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <Dashboard />
        {isEditing && <AddWidgetPanel />}
        <ViewIndicator />
      </main>
    </div>
  );
}

function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </MantineProvider>
  );
}

export default App;
