export const DISPLAY_PACKAGE_NAME = '@homeslate/display';

export { Display } from './Display';
export { HolidayEffects } from './HolidayEffects';
export {
  HOLIDAY_DEFINITIONS,
  HOLIDAY_PREVIEW_OPTIONS,
  getActiveHoliday,
  getHolidayById,
} from './holidays';
export type { HolidayDefinition, HolidayId, HolidayStyleVariant } from './holidays';
export { createViewRotationClock } from './viewRotationClock';
export type { ViewRotationSync } from './viewRotationClock';
export { AlarmRuntime } from './alarms/AlarmRuntime';
export {
  coerceAlarm,
  coerceAlarms,
  findDueAlarms,
  formatLocalDateKey,
  isAlarmScheduledOnDay,
  isValidTime,
  isWithinGraceWindow,
  normalizeDays,
  occurrenceKey,
  snoozeFireAt,
} from './alarms/schedule';
export { dedupeEnqueue, timerSnoozesAfterDismiss } from './alarms/alertQueue';
export type { AlertKind, AlertQueueItem } from './alarms/alertTypes';
export { setAlarmToneDucked, startAlarmTone, stopAlarmTone } from './alarms/tones';
export { SNOOZE_MINUTES } from './alarms/types';
export type { SnoozeMinutes } from './alarms/types';
