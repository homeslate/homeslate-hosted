import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconShare,
  IconUsers,
  IconDeviceDesktop,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import { ShareDisplayModal } from '../components/ShareDisplayModal';
import { RegisterDeviceModal } from '../components/RegisterDeviceModal';
import classes from './DisplayListPage.module.css';

export function DisplayListPage() {
  const { user, accessToken, signOut } = useAuth();
  const navigate = useNavigate();
  const { displays, addDisplay } = useDashboardStore();
  const [creating, setCreating] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [shareDisplayId, setShareDisplayId] = useState<string | null>(null);
  const [shareDisplayName, setShareDisplayName] = useState<string>('');

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

  const handleShare = (displayId: string, displayName: string) => {
    setShareDisplayId(displayId);
    setShareDisplayName(displayName);
  };

  return (
    <>
    {shareDisplayId && (
      <ShareDisplayModal
        opened={!!shareDisplayId}
        onClose={() => setShareDisplayId(null)}
        displayId={shareDisplayId}
        displayName={shareDisplayName}
      />
    )}
    <RegisterDeviceModal
      opened={registerModalOpen}
      onClose={() => setRegisterModalOpen(false)}
      onSuccess={() => {}}
      accessToken={accessToken ?? ''}
      addDisplay={addDisplay}
    />
    <div className={classes.root}>
      <header className={classes.header}>
        <Group gap="sm">
          <IconLayoutDashboard size={24} className={classes.logo} />
          <Title order={4} className={classes.title}>Your Displays</Title>
        </Group>
        <Group gap="sm">
          <Button
            leftSection={<IconDeviceDesktop size={16} />}
            variant="light"
            onClick={() => setRegisterModalOpen(true)}
            size="sm"
          >
            Register device
          </Button>
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
                  onClick={() => navigate(`/displays/${display.id}`)}
                >
                  <Stack gap={6}>
                    <Text fw={600} size="lg" className={classes.cardTitle}>{display.name}</Text>
                    <Group gap="xs">
                      <Badge variant="light" color="indigo" size="sm" w="fit-content">
                        {display.layouts.length} {display.layouts.length === 1 ? 'view' : 'views'}
                      </Badge>
                      {display.isOwner === false && (
                        <Badge
                          variant="light"
                          color="teal"
                          size="sm"
                          leftSection={<IconUsers size={10} />}
                        >
                          shared with you
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </UnstyledButton>
                <Group mt="md" justify="flex-end">
                  <Tooltip label="Share / QR code">
                    <ActionIcon
                      variant="subtle"
                      onClick={(e) => { e.stopPropagation(); handleShare(display.displayId, display.name); }}
                    >
                      <IconShare size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>
        )}
      </main>
    </div>
    </>
  );
}
