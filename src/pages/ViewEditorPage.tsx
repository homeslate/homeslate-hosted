import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Group,
  Text,
  ActionIcon,
  Tooltip,
  Button,
  Avatar,
  Menu,
  Breadcrumbs,
  Anchor,
  Modal,
  Stack,
} from '@mantine/core';
import { IconArrowLeft, IconDeviceTv, IconLogout, IconCloudCheck, IconSun, IconMoon, IconSettings } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import { useTheme } from '../contexts/ThemeContext';
import { BackgroundSlideshow } from '../components/BackgroundSlideshow';
import type { ColorMode } from '../types/theme';
import { apiClient } from '../services/apiClient';
import type { ConfigUpsertRequest } from '../types/api';
import { Dashboard } from '../components/Dashboard';
import { WidgetPanel, BgSettings } from '../components/WidgetPanel';
import { AlarmsProvider, TimersProvider } from '@homeslate/widgets';
import classes from './ViewEditorPage.module.css';

export function ViewEditorPage() {
  const { user, accessToken, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    displays,
    selectedDisplayId,
    selectedViewId,
    openPreview,
    setColorMode,
    setLayoutBackground,
    setAlarms,
  } = useDashboardStore();
  const { vars: themeVars, colorMode } = useTheme();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const view = display?.layouts.find((l) => l.id === selectedViewId);
  const [bgSettingsOpen, setBgSettingsOpen] = useState(false);

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
        d.themes !== prev.themes ||
        d.activeThemeId !== prev.activeThemeId ||
        d.colorMode !== prev.colorMode ||
        d.stickyNotesEnabled !== prev.stickyNotesEnabled ||
        d.voiceEnabled !== prev.voiceEnabled ||
        d.holidayEffectsEnabled !== prev.holidayEffectsEnabled ||
        d.holidayPreviewId !== prev.holidayPreviewId ||
        d.alarms !== prev.alarms
      ) {
        const {
          layouts,
          activeLayoutId,
          rotationEnabled,
          rotationIntervalMs,
          themes,
          activeThemeId,
          colorMode: savedColorMode,
          stickyNotesEnabled,
          voiceEnabled,
          holidayEffectsEnabled,
          holidayPreviewId,
          alarms,
        } = d;
        const payload: ConfigUpsertRequest = {
          layouts,
          activeLayoutId,
          rotationEnabled,
          rotationIntervalMs,
          themes,
          activeThemeId,
          colorMode: savedColorMode,
          stickyNotesEnabled,
          voiceEnabled,
          holidayEffectsEnabled,
          holidayPreviewId,
          alarms,
        };
        void apiClient
          .put<unknown, ConfigUpsertRequest>('/api/config', {
            token: accessToken,
            query: { displayId: selectedDisplayId },
            body: payload,
          })
          .catch(console.error);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [accessToken, selectedDisplayId]);

  if (!display || !view) return null;

  const breadcrumbs = [
    <Anchor key="display" size="sm" onClick={() => navigate(`/displays/${display.id}`)} style={{ cursor: 'pointer' }}>
      {display.name}
    </Anchor>,
    <Text key="view" size="sm" c="dimmed">{view.name}</Text>,
  ];

  const updateBg = (updates: Parameters<typeof setLayoutBackground>[1]) => {
    if (!selectedViewId) return;
    setLayoutBackground(selectedViewId, updates);
  };

  return (
    <div className={classes.root} style={themeVars as React.CSSProperties}>
      <header className={classes.header}>
        <Group gap="sm">
          <Tooltip label="Back to display">
            <ActionIcon variant="subtle" onClick={() => navigate(`/displays/${display.id}`)}>
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

      <div className={classes.pageActions}>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconSettings size={16} />}
            onClick={() => setBgSettingsOpen(true)}
          >
            Background Settings
          </Button>
          <Button
            variant="light"
            leftSection={<IconDeviceTv size={16} />}
            onClick={() => openPreview({ displayId: display.displayId, layoutId: view.id, colorMode })}
          >
            Preview This View
          </Button>
        </Group>
      </div>

      <div className={classes.body}>
        <WidgetPanel />
        <main className={classes.main} style={themeVars as React.CSSProperties}>
          <BackgroundSlideshow layout={view} />
          <TimersProvider>
            <AlarmsProvider
              alarms={display.alarms ?? []}
              onAlarmsChange={(next) => setAlarms(display.id, next)}
            >
              <Dashboard layoutId={selectedViewId ?? undefined} isEditing={true} />
            </AlarmsProvider>
          </TimersProvider>
        </main>
      </div>
      <Modal
        opened={bgSettingsOpen}
        onClose={() => setBgSettingsOpen(false)}
        title="View Background"
        size="md"
      >
        <Stack gap="md">
          <BgSettings view={view} updateBg={updateBg} />
          <Button onClick={() => setBgSettingsOpen(false)}>Done</Button>
        </Stack>
      </Modal>
    </div>
  );
}
