import type { AlarmToneId } from '@homeslate/schema';

export const ALARM_TONE_OPTIONS: { value: AlarmToneId; label: string }[] = [
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'radar', label: 'Radar' },
];
