import { useState } from 'react';
import {
  Group,
  Text,
  Title,
  Button,
  ActionIcon,
  Tooltip,
  Stack,
  Paper,
  UnstyledButton,
  Avatar,
  Menu,
  Switch,
  Select,
  Badge,
  TextInput,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconDeviceTv,
  IconLogout,
  IconEdit,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import { ThemePicker } from '../components/ThemePicker';
import type { DisplayTheme } from '../types/theme';
import classes from './DisplayDetailPage.module.css';

const INTERVAL_OPTIONS = [
  { value: '15000',   label: '15 seconds' },
  { value: '30000',   label: '30 seconds' },
  { value: '60000',   label: '1 minute'   },
  { value: '300000',  label: '5 minutes'  },
  { value: '600000',  label: '10 minutes' },
  { value: '1800000', label: '30 minutes' },
];

export function DisplayDetailPage() {
  const { user, accessToken, signOut } = useAuth();
  const {
    displays,
    selectedDisplayId,
    selectDisplay,
    selectView,
    renameDisplay,
    createLayout,
    deleteLayout,
    setRotationEnabled,
    setRotationIntervalMs,
    setDisplayTheme,
  } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(display?.name ?? '');

  if (!display) return null;

  const saveConfig = (overrides: Partial<typeof display> = {}) => {
    if (!accessToken) return;
    const { layouts, activeLayoutId, rotationEnabled, rotationIntervalMs, theme: displayTheme } = {
      ...display,
      ...overrides,
    };
    fetch(`/api/config?displayId=${display.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ layouts, activeLayoutId, rotationEnabled, rotationIntervalMs, theme: displayTheme }),
    }).catch(console.error);
  };

  const handleRename = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === display.name) {
      setEditingName(false);
      return;
    }
    renameDisplay(display.id, trimmed);
    setEditingName(false);
    if (accessToken) {
      fetch(`/api/displays?id=${display.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmed }),
      }).catch(console.error);
    }
  };

  const handleNewView = () => {
    const name = prompt('View name:', 'New View');
    if (name?.trim()) createLayout(name.trim());
  };

  const handleDeleteView = (id: string) => {
    if (display.layouts.length <= 1) {
      alert('Cannot delete the last view.');
      return;
    }
    if (confirm('Delete this view?')) deleteLayout(id);
  };

  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <Group gap="sm">
          <Tooltip label="Back to displays">
            <ActionIcon variant="subtle" onClick={() => selectDisplay(null)}>
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          {editingName ? (
            <Group gap={4}>
              <TextInput
                value={nameValue}
                onChange={(e) => setNameValue(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                size="sm"
                autoFocus
                w={200}
              />
              <ActionIcon variant="subtle" color="green" onClick={handleRename}><IconCheck size={16} /></ActionIcon>
              <ActionIcon variant="subtle" color="red" onClick={() => setEditingName(false)}><IconX size={16} /></ActionIcon>
            </Group>
          ) : (
            <Group gap={6}>
              <Title order={4} className={classes.title}>{display.name}</Title>
              <Tooltip label="Rename">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => { setNameValue(display.name); setEditingName(true); }}
                >
                  <IconEdit size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>
        <Group gap="sm">
          <Tooltip label="Open display preview in new tab">
            <ActionIcon
              variant="subtle"
              onClick={() => window.open(`/?display=${display.displayId}`, '_blank')}
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

      <main className={classes.main}>
        {/* Views section */}
        <section className={classes.section}>
          <Group justify="space-between" mb="md">
            <Title order={5} className={classes.sectionTitle}>Views</Title>
            <Button leftSection={<IconPlus size={14} />} size="xs" variant="light" onClick={handleNewView}>
              New View
            </Button>
          </Group>
          <Stack gap="xs">
            {display.layouts.map((layout) => (
              <Paper key={layout.id} className={classes.viewCard} p="sm" radius="md">
                <Group justify="space-between">
                  <UnstyledButton
                    className={classes.viewCardBtn}
                    onClick={() => selectView(layout.id)}
                  >
                    <Stack gap={2}>
                      <Text fw={500} size="sm">{layout.name}</Text>
                      <Badge variant="light" size="xs" color="dark" w="fit-content">
                        {layout.widgets.length} {layout.widgets.length === 1 ? 'widget' : 'widgets'}
                      </Badge>
                    </Stack>
                  </UnstyledButton>
                  <Tooltip label="Delete view">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => handleDeleteView(layout.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Paper>
            ))}
          </Stack>
        </section>

        {/* Settings section */}
        <section className={classes.section}>
          <Title order={5} className={classes.sectionTitle} mb="md">Settings</Title>
          <Paper className={classes.settingsCard} p="md" radius="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" fw={500}>Auto-rotate views</Text>
                  <Text size="xs" c="dimmed">Automatically cycle through views</Text>
                </Stack>
                <Switch
                  checked={display.rotationEnabled}
                  disabled={display.layouts.length <= 1}
                  onChange={(e) => {
                    setRotationEnabled(e.currentTarget.checked);
                    saveConfig({ rotationEnabled: e.currentTarget.checked });
                  }}
                />
              </Group>
              {display.rotationEnabled && display.layouts.length > 1 && (
                <Select
                  label="Rotation interval"
                  data={INTERVAL_OPTIONS}
                  value={String(display.rotationIntervalMs)}
                  onChange={(v) => {
                    if (!v) return;
                    setRotationIntervalMs(Number(v));
                    saveConfig({ rotationIntervalMs: Number(v) });
                  }}
                  size="sm"
                />
              )}
              {display.layouts.length <= 1 && (
                <Text size="xs" c="dimmed">Add a second view to enable auto-rotation</Text>
              )}
            </Stack>
          </Paper>
        </section>

        {/* Theme section */}
        <section className={classes.section}>
          <Title order={5} className={classes.sectionTitle} mb="md">Theme</Title>
          <ThemePicker
            value={display.theme}
            onChange={(theme: DisplayTheme) => {
              setDisplayTheme(display.id, theme);
              saveConfig({ theme });
            }}
          />
        </section>
      </main>
    </div>
  );
}
