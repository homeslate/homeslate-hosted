import { MantineProvider, createTheme } from '@mantine/core';
import { Dashboard, Header, AddWidgetPanel } from './components';
import { useDashboardStore } from './store/dashboardStore';
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
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});

function App() {
  const { isEditing } = useDashboardStore();

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <div className="app">
        <Header />
        <main className="main">
          <Dashboard />
          {isEditing && <AddWidgetPanel />}
        </main>
      </div>
    </MantineProvider>
  );
}

export default App;
