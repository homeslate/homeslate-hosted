import { useState } from 'react';
import { Modal, Stack, Text, TextInput, Group, Button } from '@mantine/core';

interface Props {
  opened: boolean;
  onClose: () => void;
  email: string;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountModal({ opened, onClose, email, onConfirm }: Props) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (deleting) return;
    setConfirmEmail('');
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
      setConfirmEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Delete account"
      centered
      size="sm"
    >
      <Stack gap="md">
        <Text size="sm">
          This permanently deletes your Homeslate account, owned displays, saved
          layouts, and stored Google tokens. Displays shared with you by others
          are not affected. This cannot be undone.
        </Text>
        <TextInput
          label={`Type your email to confirm`}
          placeholder={email}
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.currentTarget.value)}
          disabled={deleting}
          autoComplete="off"
        />
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={deleting}
            disabled={confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()}
            onClick={() => void handleDelete()}
          >
            Delete account
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
