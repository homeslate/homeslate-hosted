import { useState } from 'react';
import { Modal, Stack, Text, TextInput, Button } from '@mantine/core';

interface Props {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessToken: string;
  addDisplay: (id: string, displayId: string, name: string) => void;
}

export function RegisterDeviceModal({
  opened,
  onClose,
  onSuccess,
  accessToken,
  addDisplay,
}: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (trimmed.length !== 6) {
      setError('Enter the 6-character code shown on the display');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/claim-display', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to register device');
        return;
      }
      addDisplay(data.id, data.display_id, data.name);
      setCode('');
      onSuccess();
      onClose();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setCode('');
        setError(null);
        onClose();
      }}
      title="Register a display"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          On the display device, open <strong>/pair</strong> in the browser to get a 6-character code.
          Enter it below to link that device to a new display.
        </Text>
        <TextInput
          label="Pairing code"
          placeholder="e.g. ABC123"
          value={code}
          onChange={(e) => {
            setCode(e.currentTarget.value.toUpperCase().slice(0, 6));
            setError(null);
          }}
          maxLength={6}
          error={error}
          autoComplete="one-time-code"
        />
        <Button onClick={handleSubmit} loading={loading} fullWidth>
          Register display
        </Button>
      </Stack>
    </Modal>
  );
}
