import { Paper, Text } from '@mantine/core';
import type { WidgetProps } from './types';

export function unknownWidgetLabel(type: string): string {
  return `Unknown widget type: ${type}`;
}

export function UnknownWidget({ widget }: WidgetProps) {
  return (
    <Paper p="md">
      <Text c="red">{unknownWidgetLabel(widget.type)}</Text>
    </Paper>
  );
}
