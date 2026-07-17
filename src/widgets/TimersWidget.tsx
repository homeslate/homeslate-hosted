import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionIcon, Box, Button, Group, NumberInput, Paper, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import { ALARM_TONE_OPTIONS, type AlarmToneId } from '../alarms/types';
import { useTimers } from '../timers/TimersContext';
import { formatDurationMs, remainingMs } from '../timers/format';
import type { TimerPreset, TimersWidgetConfig } from '../timers/types';
import type { WidgetConfig, WidgetProps } from '../types/widget';
import classes from './TimersWidget.module.css';

export interface TimersConfig extends TimersWidgetConfig, WidgetConfig {
  presets: TimerPreset[];
  transparentBackground: boolean;
}

const TONE_IDS = new Set<AlarmToneId>(ALARM_TONE_OPTIONS.map((tone) => tone.value));

export function coerceTimerPresets(value: unknown): TimerPreset[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((preset): TimerPreset[] => {
    if (
      typeof preset === 'object' &&
      preset !== null &&
      typeof preset.id === 'string' &&
      preset.id.length > 0 &&
      typeof preset.label === 'string' &&
      typeof preset.durationSeconds === 'number' &&
      Number.isFinite(preset.durationSeconds) &&
      preset.durationSeconds > 0
    ) {
      return [{
        id: preset.id,
        label: preset.label,
        durationSeconds: preset.durationSeconds,
        toneId: typeof preset.toneId === 'string' && TONE_IDS.has(preset.toneId as AlarmToneId) ? preset.toneId as AlarmToneId : 'chime',
      }];
    }
    return [];
  });
}

function createTimerPreset(): TimerPreset {
  return {
    id: uuidv4(),
    label: 'Timer',
    durationSeconds: 300,
    toneId: 'chime',
  };
}

export function TimersWidget({ widget, onConfigChange }: WidgetProps<TimersConfig>) {
  const { runtimes, startFromPreset, pause, resume, cancel } = useTimers();
  const [now, setNow] = useState(() => Date.now());
  const presets = useMemo(() => coerceTimerPresets(widget.config.presets), [widget.config.presets]);
  const transparentBackground = widget.config.transparentBackground ?? false;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const updatePreset = useCallback(
    (id: string, patch: Partial<TimerPreset>) => {
      onConfigChange({ presets: presets.map((preset) => (preset.id === id ? { ...preset, ...patch } : preset)) });
    },
    [onConfigChange, presets],
  );

  const updateDuration = useCallback(
    (id: string, field: 'minutes' | 'seconds', value: number | string) => {
      const preset = presets.find((entry) => entry.id === id);
      if (!preset || typeof value !== 'number') return;
      const minutes = Math.floor(preset.durationSeconds / 60);
      const seconds = preset.durationSeconds % 60;
      const nextDuration = field === 'minutes' ? value * 60 + seconds : minutes * 60 + value;
      updatePreset(id, { durationSeconds: Math.max(1, Math.round(nextDuration)) });
    },
    [presets, updatePreset],
  );

  const addPreset = useCallback(() => {
    onConfigChange({ presets: [...presets, createTimerPreset()] });
  }, [onConfigChange, presets]);

  const deletePreset = useCallback(
    (id: string) => {
      onConfigChange({ presets: presets.filter((preset) => preset.id !== id) });
    },
    [onConfigChange, presets],
  );

  const noTimers = runtimes.length === 0 && presets.length === 0;

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      {noTimers ? (
        <Stack className={classes.empty} gap="sm">
          <Text size="sm" c="dimmed">
            Add a timer to get started
          </Text>
          <Button leftSection={<IconPlus size={18} />} onClick={addPreset} className={classes.touchButton}>
            Add timer
          </Button>
        </Stack>
      ) : (
        <Stack gap="sm" className={classes.list}>
          {runtimes.length > 0 && (
            <Stack gap="xs">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Active timers
              </Text>
              {runtimes.map((runtime) => (
                <Paper key={runtime.id} withBorder p="sm" radius="md" className={classes.runtimeCard}>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Stack gap={0} className={classes.runtimeDetails}>
                      <Text fw={600} truncate>
                        {runtime.label || 'Timer'}
                      </Text>
                      <Text className={classes.countdown} aria-label={`${runtime.label || 'Timer'} remaining`}>
                        {formatDurationMs(remainingMs(runtime, now))}
                      </Text>
                    </Stack>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon
                        size="lg"
                        variant="light"
                        onClick={() => (runtime.status === 'running' ? pause(runtime.id) : resume(runtime.id))}
                        aria-label={runtime.status === 'running' ? `Pause ${runtime.label || 'Timer'}` : `Resume ${runtime.label || 'Timer'}`}
                        className={classes.touchAction}
                      >
                        {runtime.status === 'running' ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}
                      </ActionIcon>
                      <ActionIcon
                        size="lg"
                        variant="light"
                        color="red"
                        onClick={() => cancel(runtime.id)}
                        aria-label={`Cancel ${runtime.label || 'Timer'}`}
                        className={classes.touchAction}
                      >
                        <IconX size={20} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Presets
              </Text>
              <ActionIcon variant="light" size="lg" onClick={addPreset} aria-label="Add timer" className={classes.touchAction}>
                <IconPlus size={20} />
              </ActionIcon>
            </Group>
            {presets.map((preset) => {
              const minutes = Math.floor(preset.durationSeconds / 60);
              const seconds = preset.durationSeconds % 60;
              return (
                <Paper key={preset.id} withBorder p="sm" radius="md">
                  <Stack gap="xs">
                    <Group gap="xs" wrap="nowrap">
                      <TextInput
                        value={preset.label}
                        onChange={(event) => updatePreset(preset.id, { label: event.currentTarget.value })}
                        aria-label="Timer label"
                        size="sm"
                        className={classes.labelInput}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="lg"
                        onClick={() => deletePreset(preset.id)}
                        aria-label={`Delete ${preset.label || 'Timer'}`}
                        className={classes.touchAction}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Group>
                    <Group gap="xs" grow>
                      <NumberInput
                        value={minutes}
                        onChange={(value) => updateDuration(preset.id, 'minutes', value)}
                        min={0}
                        suffix=" min"
                        hideControls
                        aria-label="Timer minutes"
                        size="sm"
                      />
                      <NumberInput
                        value={seconds}
                        onChange={(value) => updateDuration(preset.id, 'seconds', value)}
                        min={0}
                        max={59}
                        suffix=" sec"
                        hideControls
                        aria-label="Timer seconds"
                        size="sm"
                      />
                      <Select
                        data={ALARM_TONE_OPTIONS}
                        value={preset.toneId}
                        onChange={(value) => value && updatePreset(preset.id, { toneId: value as AlarmToneId })}
                        allowDeselect={false}
                        aria-label="Timer tone"
                        size="sm"
                      />
                    </Group>
                    <Button
                      leftSection={<IconPlayerPlay size={18} />}
                      onClick={() => startFromPreset(preset)}
                      className={classes.touchButton}
                    >
                      Start
                    </Button>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

export function TimersWidgetSettings({ widget, onConfigChange }: WidgetProps<TimersConfig>) {
  const transparentBackground = widget.config.transparentBackground ?? false;

  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed">
        Create timer presets here, then start and manage timers directly on the display.
      </Text>
      <Group justify="space-between">
        <Text size="sm">Transparent background</Text>
        <Switch
          checked={transparentBackground}
          onChange={(event) => onConfigChange({ transparentBackground: event.currentTarget.checked })}
        />
      </Group>
    </Stack>
  );
}
