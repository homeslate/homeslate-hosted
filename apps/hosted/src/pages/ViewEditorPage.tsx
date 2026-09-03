import { useEffect, useMemo, useState } from 'react';
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
} from '@mantine/core';
import { IconArrowLeft, IconDeviceTv, IconLogout, IconCloudCheck, IconSun, IconMoon } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import { useTheme } from '../contexts/ThemeContext';
import type { ColorMode, DisplayDocument } from '@homeslate/schema';
import { apiClient, ApiError } from '../services/apiClient';
import type { ConfigUpsertRequest } from '../types/api';
import { applyDocumentToDisplay, displayRecordToDocument } from '../displayDocumentBridge';
import { Editor } from '@homeslate/editor';
import { UpgradeModal } from '../components/UpgradeModal';
import classes from './ViewEditorPage.module.css';

function writeEditorDocument(displayId: string, document: DisplayDocument) {
  useDashboardStore.setState((state) => ({
    displays: state.displays.map((display) =>
      display.id === displayId ? applyDocumentToDisplay(display, document) : display,
    ),
  }));
}

export function ViewEditorPage() {
  const { user, accessToken, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    displays,
    selectedDisplayId,
    selectedViewId,
    openPreview,
    setColorMode,
  } = useDashboardStore();
  const { vars: themeVars, colorMode } = useTheme();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
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
          .catch((err) => {
            if (err instanceof ApiError && err.code === 'view_limit') {
              setUpgradeOpen(true);
              return;
            }
            console.error(err);
          });
      }
    });
    return () => {
      unsubscribe();
    };
  }, [accessToken, selectedDisplayId]);

  const document = useMemo(
    () =>
      display
        ? displayRecordToDocument({
            name: display.name,
            layouts: display.layouts,
            activeLayoutId: display.activeLayoutId,
            rotationEnabled: display.rotationEnabled,
            rotationIntervalMs: display.rotationIntervalMs,
            themes: display.themes,
            activeThemeId: display.activeThemeId,
            colorMode: display.colorMode,
            stickyNotesEnabled: display.stickyNotesEnabled,
            voiceEnabled: display.voiceEnabled,
            holidayEffectsEnabled: display.holidayEffectsEnabled,
            holidayPreviewId: display.holidayPreviewId,
            alarms: display.alarms,
          })
        : null,
    [display],
  );

  if (!display || !view || !document) return null;

  const breadcrumbs = [
    <Anchor key="display" size="sm" onClick={() => navigate(`/displays/${display.id}`)} style={{ cursor: 'pointer' }}>
      {display.name}
    </Anchor>,
    <Text key="view" size="sm" c="dimmed">{view.name}</Text>,
  ];

  return (
    <>
    <UpgradeModal opened={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
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

      <Editor
        document={document}
        viewId={view.id}
        onChange={(next) => writeEditorDocument(display.id, next)}
        onUploadBackgroundPhoto={(payload) =>
          apiClient.post<{ key: string; filename: string }, typeof payload>('/api/photo-upload', {
            body: payload,
          })
        }
        actions={
          <Button
            variant="light"
            leftSection={<IconDeviceTv size={16} />}
            onClick={() => openPreview({ displayId: display.displayId, layoutId: view.id, colorMode })}
          >
            Preview This View
          </Button>
        }
      />
    </div>
    </>
  );
}
