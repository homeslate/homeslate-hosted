import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Stack, Group, Switch, TextInput, Select, ActionIcon, Text, Paper } from '@mantine/core';
import { TimeInput, type TimeInputProps } from '@mantine/dates';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import { isValidTime } from './schedule';
import { ALARM_TONE_OPTIONS, type AlarmDefinition, type AlarmToneId } from './types';
import classes from './AlarmListEditor.module.css';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function summarizeDays(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'Never';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES_SHORT[d])
    .join(', ');
}

function AlarmTimeInput({
  value,
  onChange,
  ...props
}: { value: string; onChange: (time: string) => void } & Omit<TimeInputProps, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.currentTarget.value;
    setDraft(next);
    if (isValidTime(next)) {
      onChange(next);
    }
  };

  const handleBlur = () => {
    if (!isValidTime(draft)) {
      setDraft(value);
    }
  };

  return <TimeInput value={draft} onChange={handleChange} onBlur={handleBlur} {...props} />;
}

function createAlarm(): AlarmDefinition {
  return {
    id: uuidv4(),
    label: 'Alarm',
    enabled: true,
    time: '07:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    toneId: 'chime',
  };
}

interface AlarmListEditorProps {
  alarms: AlarmDefinition[];
  onChange: (alarms: AlarmDefinition[]) => void;
  readOnly?: boolean;
}

export function AlarmListEditor({ alarms, onChange, readOnly = false }: AlarmListEditorProps) {
  const updateAlarm = useCallback(
    (id: string, patch: Partial<AlarmDefinition>) => {
      onChange(alarms.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [alarms, onChange]
  );

  const toggleDay = useCallback(
    (id: string, day: number) => {
      const alarm = alarms.find((a) => a.id === id);
      if (!alarm) return;
      const nextDays = alarm.days.includes(day)
        ? alarm.days.filter((d) => d !== day)
        : [...alarm.days, day].sort((a, b) => a - b);
      updateAlarm(id, { days: nextDays });
    },
    [alarms, updateAlarm]
  );

  const handleAdd = useCallback(() => {
    onChange([...alarms, createAlarm()]);
  }, [alarms, onChange]);

  const handleDelete = useCallback(
    (id: string) => {
      onChange(alarms.filter((a) => a.id !== id));
    },
    [alarms, onChange]
  );

  if (alarms.length === 0) {
    return (
      <Stack gap="sm" className={classes.list}>
        <Text size="sm" c="dimmed">
          No alarms set.
        </Text>
        {!readOnly && (
          <ActionIcon
            variant="light"
            size="lg"
            onClick={handleAdd}
            aria-label="Add alarm"
            className={classes.addBtn}
          >
            <IconPlus size={18} />
          </ActionIcon>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="sm" className={classes.list}>
      {alarms.map((alarm) => (
        <Paper key={alarm.id} className={classes.card} withBorder p="sm" radius="md">
          {readOnly ? (
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  {alarm.label || 'Alarm'}
                </Text>
                <Text size="xs" c="dimmed">
                  {alarm.time} · {summarizeDays(alarm.days)}
                </Text>
              </Stack>
              <Switch checked={alarm.enabled} readOnly disabled aria-label={`${alarm.label || 'Alarm'} enabled`} />
            </Group>
          ) : (
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <TextInput
                  value={alarm.label}
                  onChange={(e) => updateAlarm(alarm.id, { label: e.currentTarget.value })}
                  placeholder="Alarm"
                  size="sm"
                  style={{ flex: 1, minWidth: 0 }}
                  aria-label="Alarm label"
                />
                <Switch
                  checked={alarm.enabled}
                  onChange={(e) => updateAlarm(alarm.id, { enabled: e.currentTarget.checked })}
                  aria-label="Alarm enabled"
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => handleDelete(alarm.id)}
                  aria-label="Delete alarm"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
              <Group gap="xs" wrap="wrap">
                <AlarmTimeInput
                  value={alarm.time}
                  onChange={(time) => updateAlarm(alarm.id, { time })}
                  size="sm"
                  aria-label="Alarm time"
                  className={classes.timeInput}
                />
                <Select
                  data={ALARM_TONE_OPTIONS}
                  value={alarm.toneId}
                  onChange={(value) => value && updateAlarm(alarm.id, { toneId: value as AlarmToneId })}
                  size="sm"
                  aria-label="Alarm tone"
                  allowDeselect={false}
                  className={classes.toneSelect}
                />
              </Group>
              <Group gap={4} className={classes.dayRow}>
                {DAY_LABELS.map((label, idx) => {
                  const active = alarm.days.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`${classes.dayChip} ${active ? classes.dayChipActive : ''}`}
                      onClick={() => toggleDay(alarm.id, idx)}
                      aria-pressed={active}
                      aria-label={DAY_NAMES_SHORT[idx]}
                    >
                      {label}
                    </button>
                  );
                })}
              </Group>
            </Stack>
          )}
        </Paper>
      ))}
      {!readOnly && (
        <ActionIcon variant="light" size="lg" onClick={handleAdd} aria-label="Add alarm" className={classes.addBtn}>
          <IconPlus size={18} />
        </ActionIcon>
      )}
    </Stack>
  );
}
