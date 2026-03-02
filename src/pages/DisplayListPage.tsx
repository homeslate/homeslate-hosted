import { useState, useEffect } from 'react';
import {
  Group,
  Text,
  Title,
  Button,
  SimpleGrid,
  Paper,
  UnstyledButton,
  Avatar,
  Menu,
  ActionIcon,
  Tooltip,
  Stack,
  Badge,
} from '@mantine/core';
import {
  IconLayoutDashboard,
  IconLogout,
  IconPlus,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import type { RemoteDisplay } from '../store/dashboardStore';
import classes from './DisplayListPage.module.css';

export function DisplayListPage() {
  const { user, accessToken, signOut } = useAuth();
  const { displays, setDisplays, addDisplay, selectDisplay } = useDashboardStore();
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load displays from API on mount
  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/displays', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((rows: RemoteDisplay[]) => setDisplays(rows))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleNewDisplay = async () => {
    const name = prompt('Display name:', 'Kitchen Display');
    if (!name?.trim() || !accessToken) return;
    setCreating(true);
    try {
      const res = await fetch('/api/displays', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      const row = await res.json() as { id: string; display_id: string; name: string };
      addDisplay(row.id, row.display_id, row.name);
    } catch (err) {
      console.error('Failed to create display:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyUrl = (displayId: string) => {
    const url = `${window.location.origin}/?display=${displayId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(displayId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <Group gap="sm">
          <IconLayoutDashboard size={24} className={classes.logo} />
          <Title order={4} className={classes.title}>Your Displays</Title>
        </Group>
        <Group gap="sm">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleNewDisplay}
            loading={creating}
            size="sm"
          >
            New Display
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
        </Group>
      </header>

      <main className={classes.main}>
        {displays.length === 0 ? (
          <div className={classes.empty}>
            <IconLayoutDashboard size={48} opacity={0.3} />
            <Text c="dimmed" mt="md">No displays yet. Create one to get started.</Text>
          </div>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {displays.map((display) => (
              <Paper key={display.id} className={classes.card} p="lg" radius="md">
                <UnstyledButton
                  className={classes.cardInner}
                  onClick={() => selectDisplay(display.id)}
                >
                  <Stack gap={6}>
                    <Text fw={600} size="lg" className={classes.cardTitle}>{display.name}</Text>
                    <Badge variant="light" color="indigo" size="sm" w="fit-content">
                      {display.layouts.length} {display.layouts.length === 1 ? 'view' : 'views'}
                    </Badge>
                  </Stack>
                </UnstyledButton>
                <Group mt="md" justify="flex-end">
                  <Tooltip label={copiedId === display.displayId ? 'Copied!' : 'Copy display URL'}>
                    <ActionIcon
                      variant="subtle"
                      onClick={(e) => { e.stopPropagation(); handleCopyUrl(display.displayId); }}
                    >
                      {copiedId === display.displayId ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        )}
      </main>
    </div>
  );
}
