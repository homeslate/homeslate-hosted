export type { AlarmDefinition, AlarmToneId } from '@homeslate/schema';

export const SNOOZE_MINUTES = [5, 10, 15] as const;
export type SnoozeMinutes = (typeof SNOOZE_MINUTES)[number];
