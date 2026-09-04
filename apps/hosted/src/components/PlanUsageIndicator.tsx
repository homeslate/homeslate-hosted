import { Badge, Tooltip } from '@mantine/core';
import type { PlanUsageDisplay } from '../billing/planUsage';

interface Props {
  usage: PlanUsageDisplay | null;
  onUpgradeClick?: () => void;
}

export function PlanUsageIndicator({ usage, onUpgradeClick }: Props) {
  if (!usage) return null;

  const { label, atLimit, emphasized } = usage;
  const canUpgrade = atLimit && Boolean(onUpgradeClick);
  const tooltip = emphasized
    ? 'Plan limit reached — click to upgrade to Pro'
    : atLimit
      ? 'Upgrade for unlimited displays and views'
      : 'Free plan usage';

  return (
    <Tooltip label={tooltip}>
      <Badge
        variant="light"
        color={emphasized ? 'orange' : 'gray'}
        size="sm"
        style={{ cursor: canUpgrade ? 'pointer' : undefined }}
        onClick={canUpgrade ? onUpgradeClick : undefined}
      >
        {label}
      </Badge>
    </Tooltip>
  );
}
