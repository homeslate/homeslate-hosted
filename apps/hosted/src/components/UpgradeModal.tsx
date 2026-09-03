import { Modal, Stack, Text, Group, Button, List } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';

interface Props {
  opened: boolean;
  onClose: () => void;
}

const billingEnabled = import.meta.env.VITE_BILLING_ENABLED === 'true';

export function UpgradeModal({ opened, onClose }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Upgrade to Pro"
      centered
      size="sm"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          You&apos;ve reached the limit on the Free plan. Upgrade to Pro to unlock:
        </Text>
        <List
          spacing="xs"
          size="sm"
          icon={<IconSparkles size={16} stroke={1.5} />}
        >
          <List.Item>Unlimited displays</List.Item>
          <List.Item>Unlimited views per display</List.Item>
        </List>
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onClose}>
            Not now
          </Button>
          <Button
            disabled={!billingEnabled}
            onClick={billingEnabled ? onClose : undefined}
          >
            Upgrade
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
