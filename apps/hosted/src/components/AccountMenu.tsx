import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Menu, Tooltip } from '@mantine/core';
import { IconLogout, IconTrash } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import { apiClient } from '../services/apiClient';
import { DeleteAccountModal } from './DeleteAccountModal';

export function AccountMenu() {
  const { user, accessToken, signOut } = useAuth();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDeleteAccount = async () => {
    if (!accessToken) throw new Error('Not signed in');
    await apiClient.delete('/api/me', { token: accessToken });
    useDashboardStore.persist.clearStorage();
    useDashboardStore.setState({
      displays: [],
      selectedDisplayId: null,
      selectedViewId: null,
      preview: null,
    });
    signOut();
    setDeleteOpen(false);
    navigate('/');
  };

  if (!user) return null;

  return (
    <>
      <Menu position="bottom-end" withArrow shadow="md">
        <Menu.Target>
          <Tooltip label={user.name}>
            <Avatar
              src={user.picture}
              alt={user.name}
              size="sm"
              radius="xl"
              style={{ cursor: 'pointer' }}
            />
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{user.email}</Menu.Label>
          <Menu.Item
            leftSection={<IconTrash size={14} />}
            color="red"
            onClick={() => setDeleteOpen(true)}
          >
            Delete account
          </Menu.Item>
          <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={signOut}>
            Sign out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <DeleteAccountModal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        email={user.email}
        onConfirm={handleDeleteAccount}
      />
    </>
  );
}
