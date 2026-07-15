import { Box, Stack, Text, Group, Switch } from '@mantine/core';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useAlarms } from '../alarms/AlarmsContext';
import { AlarmListEditor } from '../alarms/AlarmListEditor';
import classes from './AlarmsWidget.module.css';

export interface AlarmsConfig extends WidgetConfig {
  transparentBackground: boolean;
}

export function AlarmsWidget({ widget }: WidgetProps<AlarmsConfig>) {
  const { transparentBackground } = widget.config;
  const { provided, alarms, onAlarmsChange, readOnly } = useAlarms();

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      {provided ? (
        <AlarmListEditor
          alarms={alarms}
          onChange={onAlarmsChange ?? (() => {})}
          readOnly={readOnly}
        />
      ) : (
        <Stack className={classes.empty} gap={4}>
          <Text size="sm" c="dimmed" ta="center">
            Add alarms in Display Settings
          </Text>
        </Stack>
      )}
    </Box>
  );
}

export function AlarmsWidgetSettings({ widget, onConfigChange }: WidgetProps<AlarmsConfig>) {
  const { transparentBackground } = widget.config;
  const { provided, alarms, onAlarmsChange, readOnly } = useAlarms();

  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed">
        Manage recurring alarms directly on the widget, or here.
      </Text>

      <Group justify="space-between">
        <Text size="sm">Transparent background</Text>
        <Switch
          checked={transparentBackground}
          onChange={(e) => onConfigChange({ transparentBackground: e.currentTarget.checked })}
        />
      </Group>

      {provided && (
        <AlarmListEditor
          alarms={alarms}
          onChange={onAlarmsChange ?? (() => {})}
          readOnly={readOnly}
        />
      )}
    </Stack>
  );
}
