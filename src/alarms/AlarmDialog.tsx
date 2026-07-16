import { Button, ActionIcon, Text } from '@mantine/core';
import { IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { SNOOZE_MINUTES, type SnoozeMinutes } from './types';
import type { VoiceStatusReason } from '../voice/useAlarmVoiceCommands';
import classes from './AlarmDialog.module.css';

interface Props {
  label: string;
  time: string;
  muted: boolean;
  showSnoozeChoices: boolean;
  voiceListening?: boolean;
  voiceUnavailableReason?: VoiceStatusReason | null;
  onToggleMute: () => void;
  onDismiss: () => void;
  onOpenSnooze: () => void;
  onSnooze: (minutes: SnoozeMinutes) => void;
}

function voiceStatusLabel(
  listening: boolean,
  reason: VoiceStatusReason | null | undefined,
): string | null {
  if (listening) return 'Listening for dismiss or snooze';
  if (reason === 'unsupported' || reason === 'denied' || reason === 'error') {
    return 'Voice unavailable';
  }
  return null;
}

export function AlarmDialog({
  label,
  time,
  muted,
  showSnoozeChoices,
  voiceListening = false,
  voiceUnavailableReason = null,
  onToggleMute,
  onDismiss,
  onOpenSnooze,
  onSnooze,
}: Props) {
  const status = voiceStatusLabel(voiceListening, voiceUnavailableReason);

  return (
    <div className={classes.overlay} role="alertdialog" aria-modal="true" aria-label={label}>
      <div className={classes.card}>
        <div className={classes.topRow}>
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute alarm' : 'Mute alarm'}
          >
            {muted ? <IconVolumeOff size={22} /> : <IconVolume size={22} />}
          </ActionIcon>
        </div>
        <div className={`${classes.pulse} ${muted ? classes.pulseSilent : ''}`} />
        <div className={classes.label}>{label || 'Alarm'}</div>
        <div className={classes.time}>{time}</div>
        {status ? (
          <Text
            size="sm"
            c="dimmed"
            className={classes.voiceStatus}
            data-listening={voiceListening ? 'true' : undefined}
          >
            {status}
          </Text>
        ) : null}
        <div className={classes.actions}>
          <Button size="xl" onClick={onDismiss}>
            Dismiss
          </Button>
          {!showSnoozeChoices ? (
            <Button size="xl" variant="light" onClick={onOpenSnooze}>
              Snooze
            </Button>
          ) : (
            <div className={classes.snoozeRow}>
              {SNOOZE_MINUTES.map((m) => (
                <Button key={m} size="lg" variant="light" onClick={() => onSnooze(m)}>
                  {m} min
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
