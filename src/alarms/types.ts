export type AlarmToneId = 'chime' | 'bell' | 'radar';

export interface AlarmDefinition {
  id: string;
  label: string;
  enabled: boolean;
  time: string; // HH:mm
  days: number[]; // 0=Sun..6=Sat
  toneId: AlarmToneId;
}

export const ALARM_TONE_OPTIONS: { value: AlarmToneId; label: string }[] = [
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'radar', label: 'Radar' },
];

export const SNOOZE_MINUTES = [5, 10, 15] as const;
export type SnoozeMinutes = (typeof SNOOZE_MINUTES)[number];
