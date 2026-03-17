import { useEffect } from 'react';
import { Text } from '@mantine/core';

export type WidgetHealthStatus = 'idle' | 'loading' | 'ok' | 'stale' | 'error';

interface WidgetDataStatusProps {
  widgetId?: string;
  lastUpdated: number | null;
  error?: string | null;
  isLoading?: boolean;
  align?: 'left' | 'center' | 'right';
}

function formatLastUpdated(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function WidgetDataStatus({
  widgetId,
  lastUpdated,
  error,
  isLoading = false,
  align = 'left',
}: WidgetDataStatusProps) {
  useEffect(() => {
    if (!widgetId || typeof window === 'undefined') return;

    let status: WidgetHealthStatus = 'idle';
    if (error && lastUpdated) status = 'stale';
    else if (error) status = 'error';
    else if (isLoading) status = 'loading';
    else if (lastUpdated) status = 'ok';

    window.dispatchEvent(
      new CustomEvent('widget-health-change', {
        detail: { widgetId, status },
      })
    );
  }, [widgetId, error, isLoading, lastUpdated]);

  if (!lastUpdated) return null;

  return (
    <Text size="xs" c={error ? 'yellow.3' : 'dimmed'} ta={align}>
      {error
        ? `Last updated ${formatLastUpdated(lastUpdated)} (showing cached data)`
        : `Updated ${formatLastUpdated(lastUpdated)}`}
    </Text>
  );
}
