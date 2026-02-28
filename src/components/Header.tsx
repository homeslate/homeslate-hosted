import {
  Group,
  Button,
  Text,
  Select,
  ActionIcon,
  Tooltip,
  Popover,
  Switch,
  Stack,
  Avatar,
  Menu,
} from '@mantine/core';
import {
  IconEdit,
  IconCheck,
  IconPlus,
  IconLayoutDashboard,
  IconRepeat,
  IconBrandGoogle,
  IconLogout,
} from '@tabler/icons-react';
import { useDashboardStore } from '../store/dashboardStore';
import { useAuth } from '../contexts/AuthContext';
import classes from './Header.module.css';

const INTERVAL_OPTIONS = [
  { value: '15000',   label: '15 seconds' },
  { value: '30000',   label: '30 seconds' },
  { value: '60000',   label: '1 minute'   },
  { value: '300000',  label: '5 minutes'  },
  { value: '600000',  label: '10 minutes' },
  { value: '1800000', label: '30 minutes' },
];

export function Header() {
  const {
    layouts,
    activeLayoutId,
    isEditing,
    rotationEnabled,
    rotationIntervalMs,
    setActiveLayout,
    toggleEditing,
    createLayout,
    setRotationEnabled,
    setRotationIntervalMs,
  } = useDashboardStore();

  const { user, isAuthenticated, isLoading, signIn, signOut } = useAuth();

  const layoutOptions = layouts.map((l) => ({
    value: l.id,
    label: l.name,
  }));

  const handleNewLayout = () => {
    const name = prompt('Enter view name:');
    if (name) {
      createLayout(name);
    }
  };

  const multipleViews = layouts.length > 1;

  return (
    <header className={classes.header}>
      <Group gap="md">
        <IconLayoutDashboard size={28} className={classes.logo} />
        <Text className={classes.title}>Kitchen Display</Text>
      </Group>

      <Group gap="sm">
        <Select
          data={layoutOptions}
          value={activeLayoutId}
          onChange={(value) => value && setActiveLayout(value)}
          placeholder="Select view"
          size="sm"
          w={180}
          classNames={{ input: classes.selectInput }}
        />

        <Tooltip label="New view">
          <ActionIcon
            variant="subtle"
            onClick={handleNewLayout}
            className={classes.actionButton}
          >
            <IconPlus size={18} />
          </ActionIcon>
        </Tooltip>

        {/* Auto-rotate settings */}
        <Popover position="bottom-end" withArrow shadow="md" width={220}>
          <Popover.Target>
            <Tooltip label={rotationEnabled ? 'Auto-rotating' : 'Auto-rotate views'}>
              <ActionIcon
                variant={rotationEnabled ? 'filled' : 'subtle'}
                color={rotationEnabled ? 'indigo' : undefined}
                className={rotationEnabled ? undefined : classes.actionButton}
              >
                <IconRepeat size={18} />
              </ActionIcon>
            </Tooltip>
          </Popover.Target>

          <Popover.Dropdown>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" fw={500}>Auto-rotate views</Text>
                <Switch
                  checked={rotationEnabled}
                  disabled={!multipleViews}
                  onChange={(e) => setRotationEnabled(e.currentTarget.checked)}
                />
              </Group>

              {rotationEnabled && multipleViews && (
                <Select
                  label="Interval"
                  data={INTERVAL_OPTIONS}
                  value={String(rotationIntervalMs)}
                  onChange={(v) => v && setRotationIntervalMs(Number(v))}
                  size="sm"
                />
              )}

              {!multipleViews && (
                <Text size="xs" c="dimmed">
                  Add a second view to enable auto-rotation
                </Text>
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>

        {isAuthenticated ? (
          <>
            <Button
              variant={isEditing ? 'filled' : 'light'}
              color={isEditing ? 'green' : 'indigo'}
              leftSection={isEditing ? <IconCheck size={18} /> : <IconEdit size={18} />}
              onClick={toggleEditing}
              className={classes.editButton}
            >
              {isEditing ? 'Done' : 'Edit Layout'}
            </Button>

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
                <Menu.Item
                  leftSection={<IconLogout size={14} />}
                  color="red"
                  onClick={signOut}
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        ) : (
          <Button
            variant="light"
            color="indigo"
            leftSection={<IconBrandGoogle size={18} />}
            onClick={signIn}
            loading={isLoading}
            className={classes.editButton}
          >
            Sign in to Edit
          </Button>
        )}
      </Group>
    </header>
  );
}
