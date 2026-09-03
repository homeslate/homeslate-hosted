import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  TextInput,
  Button,
  Avatar,
  ActionIcon,
  Tooltip,
  Divider,
  Badge,
  Paper,
} from '@mantine/core';
import { IconTrash, IconMail, IconUser } from '@tabler/icons-react';
import { apiClient, ApiError } from '../services/apiClient';
import type {
  CollaboratorDto,
  InviteCreateRequest,
  InviteCreateResponse,
  InviteListResponse,
  InviteSummaryDto,
} from '../types/api';

interface Props {
  opened: boolean;
  onClose: () => void;
  displayId: string;
  displayName: string;
  accessToken: string;
}

export function InviteModal({ opened, onClose, displayId, displayName, accessToken }: Props) {
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const [invites, setInvites] = useState<InviteSummaryDto[]>([]);
  const [collaborators, setCollaborators] = useState<CollaboratorDto[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInvites = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiClient.get<InviteListResponse>('/api/invites', {
        token: accessToken,
        query: { displayId },
      });
      setInvites(data.invites);
      setCollaborators(data.collaborators);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [accessToken, displayId]);

  useEffect(() => {
    if (opened) {
      loadInvites();
      setEmail('');
      setInviteError(null);
      setInviteSuccess(null);
    }
  }, [opened, loadInvites]);

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const data = await apiClient.post<InviteCreateResponse, InviteCreateRequest>(
        '/api/invites',
        {
          token: accessToken,
          body: { displayId, email: trimmed },
        }
      );
      if (!data.invited_email) {
        setInviteError('Failed to send invite');
      } else {
        setEmail('');
        setInviteSuccess(`Invite sent to ${data.invited_email}`);
        await loadInvites();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setInviteError(err.message);
      } else {
        setInviteError('Network error');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteEmail: string) => {
    try {
      await apiClient.delete<unknown>('/api/invites', {
        token: accessToken,
        query: { displayId, email: inviteEmail },
      });
      await loadInvites();
    } catch {
      // ignore
    }
  };

  const handleRemoveCollaborator = async (collaboratorRowId: string) => {
    try {
      await apiClient.delete<unknown>('/api/invites', {
        token: accessToken,
        query: { displayId, collaboratorId: collaboratorRowId },
      });
      await loadInvites();
    } catch {
      // ignore
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Invite to "${displayName}"`}
      centered
      size="sm"
    >
      <Stack gap="md">
        {/* Invite form */}
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Enter a Google account email. They will gain full access to this display when they next sign in.
          </Text>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <TextInput
              placeholder="someone@gmail.com"
              value={email}
              onChange={(e) => { setEmail(e.currentTarget.value); setInviteError(null); setInviteSuccess(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) handleInvite(); }}
              style={{ flex: 1 }}
              error={inviteError ?? undefined}
              leftSection={<IconMail size={14} />}
            />
            <Button
              size="sm"
              loading={inviting}
              disabled={!email.trim()}
              onClick={handleInvite}
              style={{ flexShrink: 0 }}
            >
              Invite
            </Button>
          </Group>
          {inviteSuccess && (
            <Text size="xs" c="teal">{inviteSuccess}</Text>
          )}
        </Stack>

        {/* Collaborators */}
        {!loading && collaborators.length > 0 && (
          <>
            <Divider label="Has access" labelPosition="left" />
            <Stack gap="xs">
              {collaborators.map((c) => (
                <Paper key={c.id} p="xs" radius="md" withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Avatar src={c.picture} size="sm" radius="xl">
                        <IconUser size={14} />
                      </Avatar>
                      <Stack gap={1} style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>{c.name}</Text>
                        <Text size="xs" c="dimmed" truncate>{c.email}</Text>
                      </Stack>
                    </Group>
                    <Tooltip label="Remove access">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleRemoveCollaborator(c.id)}
                        style={{ flexShrink: 0 }}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </>
        )}

        {/* Pending invites */}
        {!loading && invites.length > 0 && (
          <>
            <Divider label="Pending invites" labelPosition="left" />
            <Stack gap="xs">
              {invites.map((inv) => (
                <Paper key={inv.id} p="xs" radius="md" withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                      <IconMail size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
                      <Stack gap={1} style={{ minWidth: 0 }}>
                        <Text size="sm" truncate>{inv.invited_email}</Text>
                        <Badge variant="outline" size="xs" color="yellow">awaiting sign-in</Badge>
                      </Stack>
                    </Group>
                    <Tooltip label="Revoke invite">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleRevokeInvite(inv.invited_email)}
                        style={{ flexShrink: 0 }}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </>
        )}

        {!loading && collaborators.length === 0 && invites.length === 0 && (
          <Text size="xs" c="dimmed" ta="center">No one else has access to this display yet.</Text>
        )}
      </Stack>
    </Modal>
  );
}
