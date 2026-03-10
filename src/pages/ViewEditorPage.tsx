import { useEffect } from 'react';
import {
  Group,
  Text,
  ActionIcon,
  Tooltip,
  Avatar,
  Menu,
  Breadcrumbs,
  Anchor,
} from '@mantine/core';
import { IconArrowLeft, IconDeviceTv, IconLogout, IconCloudCheck, IconSun, IconMoon } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import { useTheme, themeToVars } from '../contexts/ThemeContext';
import { BackgroundSlideshow } from '../components/BackgroundSlideshow';
import type { ColorMode } from '../types/theme';
import { Dashboard } from '../components/Dashboard';
import { WidgetPanel } from '../components/WidgetPanel';
import classes from './ViewEditorPage.module.css';

export function ViewEditorPage() {
  const { user, accessToken, signOut } = useAuth();
  const {
    displays,
    selectedDisplayId,
    selectedViewId,
    selectDisplay,
    selectView,
    openPreview,
    setColorMode,
  } = useDashboardStore();
  const { theme, colorMode } = useTheme();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const view = display?.layouts.find((l) => l.id === selectedViewId);

  // Subscribe to store changes and save immediately on each action.
  // We read state directly from the subscription callback so we always
  // save the latest layout rather than a stale closure snapshot.
  useEffect(() => {
    if (!accessToken || !selectedDisplayId) return;
    const unsubscribe = useDashboardStore.subscribe((state, prevState) => {
      const d = state.displays.find((d) => d.id === selectedDisplayId);
      const prev = prevState.displays.find((d) => d.id === selectedDisplayId);
      if (!d || !prev) return;
      if (
        d.layouts !== prev.layouts ||
        d.theme !== prev.theme ||
        d.stickyNotesEnabled !== prev.stickyNotesEnabled
      ) {
        const { layouts, activeLayoutId, rotationEnabled, rotationIntervalMs, theme: displayTheme, stickyNotesEnabled } = d;
        fetch(`/api/config?displayId=${selectedDisplayId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ layouts, activeLayoutId, rotationEnabled, rotationIntervalMs, theme: displayTheme, stickyNotesEnabled }),
        }).catch(console.error);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [accessToken, selectedDisplayId]);

  if (!display || !view) return null;

  const breadcrumbs = [
    <Anchor key="display" size="sm" onClick={() => selectDisplay(selectedDisplayId)} style={{ cursor: 'pointer' }}>
      {display.name}
    </Anchor>,
    <Text key="view" size="sm" c="dimmed">{view.name}</Text>,
  ];

  return (
    <div className={classes.root} style={themeToVars(theme, colorMode) as React.CSSProperties}>
      <header className={classes.header}>
        <Group gap="sm">
          <Tooltip label="Back to display">
            <ActionIcon variant="subtle" onClick={() => selectView(null)}>
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Breadcrumbs>{breadcrumbs}</Breadcrumbs>
        </Group>
        <Group gap="sm">
          <Tooltip label="Auto-save enabled">
            <IconCloudCheck size={18} opacity={0.5} />
          </Tooltip>
          <Tooltip label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <ActionIcon
              variant="subtle"
              onClick={() => {
                const next: ColorMode = colorMode === 'dark' ? 'light' : 'dark';
                setColorMode(display.id, next);
              }}
            >
              {colorMode === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Tooltip>
            <Tooltip label="Preview display">
              <ActionIcon
                variant="subtle"
                onClick={() => openPreview(display.displayId)}
              >
                <IconDeviceTv size={18} />
              </ActionIcon>
            </Tooltip>
          <Menu position="bottom-end" withArrow shadow="md">
            <Menu.Target>
              <Tooltip label={user?.name ?? ''}>
                <Avatar
                  src={user?.picture}
                  alt={user?.name}
                  size="sm"
                  radius="xl"
                  style={{ cursor: 'pointer' }}
                />
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user?.email}</Menu.Label>
              <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={signOut}>
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </header>

      <div className={classes.body}>
        <WidgetPanel />
        <main className={classes.main} style={themeToVars(theme, colorMode) as React.CSSProperties}>
          <BackgroundSlideshow layout={view} />
          <Dashboard layoutId={selectedViewId ?? undefined} isEditing={true} />
        </main>
      </div>
    </div>
  );
}
