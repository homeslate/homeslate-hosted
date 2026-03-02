import { useEffect, useCallback } from 'react';
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
import { IconArrowLeft, IconDeviceTv, IconLogout, IconCloudCheck } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import { useTheme, themeToVars } from '../contexts/ThemeContext';
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
  } = useDashboardStore();
  const { theme } = useTheme();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const view = display?.layouts.find((l) => l.id === selectedViewId);

  // Save immediately on each action
  const saveConfig = useCallback(() => {
    if (!accessToken || !selectedDisplayId || !display) return;
    const { layouts, activeLayoutId, rotationEnabled, rotationIntervalMs, theme: displayTheme } = display;
    fetch(`/api/config?displayId=${selectedDisplayId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ layouts, activeLayoutId, rotationEnabled, rotationIntervalMs, theme: displayTheme }),
    }).catch(console.error);
  }, [accessToken, selectedDisplayId, display]);

  // Subscribe to store changes and save immediately on each action
  useEffect(() => {
    const unsubscribe = useDashboardStore.subscribe((state, prevState) => {
      const d = state.displays.find((d) => d.id === selectedDisplayId);
      const prev = prevState.displays.find((d) => d.id === selectedDisplayId);
      if (d && prev && (d.layouts !== prev.layouts || d.theme !== prev.theme)) {
        saveConfig();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [selectedDisplayId, saveConfig]);

  if (!display || !view) return null;

  const breadcrumbs = [
    <Anchor key="display" size="sm" onClick={() => selectDisplay(selectedDisplayId)} style={{ cursor: 'pointer' }}>
      {display.name}
    </Anchor>,
    <Text key="view" size="sm" c="dimmed">{view.name}</Text>,
  ];

  return (
    <div className={classes.root}>
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
            <Tooltip label="Open display preview in new tab">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                saveConfig();
                window.open(`/?display=${display.displayId}`, '_blank');
              }}
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
        <main className={classes.main} style={themeToVars(theme) as React.CSSProperties}>
          <Dashboard layoutId={selectedViewId ?? undefined} isEditing={true} />
        </main>
      </div>
    </div>
  );
}
