import { Modal, Stack, Text, Group, Button, List, Radio } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { billingEnabled, getCheckoutPriceIds, useBillingActions } from '../billing/useBillingActions';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function UpgradeModal({ opened, onClose }: Props) {
  const { accessToken } = useAuth();
  const { startCheckout, loading, error } = useBillingActions(accessToken);
  const prices = getCheckoutPriceIds();
  const defaultPrice = prices.monthly ?? prices.annual ?? '';
  const [priceId, setPriceId] = useState(defaultPrice);

  const canUpgrade =
    billingEnabled && Boolean(prices.monthly || prices.annual) && Boolean(accessToken);

  const handleUpgrade = () => {
    if (!priceId) return;
    void startCheckout(priceId);
  };

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
        {canUpgrade && (prices.monthly || prices.annual) && (
          <Radio.Group value={priceId} onChange={setPriceId} label="Billing interval">
            <Stack gap="xs" mt="xs">
              {prices.monthly && (
                <Radio value={prices.monthly} label="Monthly" />
              )}
              {prices.annual && (
                <Radio value={prices.annual} label="Annual" />
              )}
            </Stack>
          </Radio.Group>
        )}
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Not now
          </Button>
          <Button
            disabled={!canUpgrade || !priceId}
            loading={loading}
            onClick={canUpgrade ? handleUpgrade : undefined}
          >
            {canUpgrade ? 'Upgrade' : 'Coming soon'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
