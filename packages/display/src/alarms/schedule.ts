import type { AlarmDefinition } from './types';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

export function normalizeDays(days: unknown): number[] {
  if (!Array.isArray(days) || days.length === 0) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  const cleaned = days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6);
  if (cleaned.length === 0) return [0, 1, 2, 3, 4, 5, 6];
  return [...new Set(cleaned)].sort((a, b) => a - b);
}

export function isAlarmScheduledOnDay(alarm: AlarmDefinition, day: number): boolean {
  return normalizeDays(alarm.days).includes(day);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function occurrenceKey(alarmId: string, date: Date, time: string): string {
  return `${alarmId}|${formatLocalDateKey(date)}|${time}`;
}

/** True if now is in [targetMinuteStart, targetMinuteStart + graceMs). */
export function isWithinGraceWindow(now: Date, time: string, graceMs: number): boolean {
  if (!isValidTime(time)) return false;
  const [hh, mm] = time.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  const delta = now.getTime() - target.getTime();
  return delta >= 0 && delta < graceMs;
}

export function findDueAlarms(
  alarms: AlarmDefinition[],
  now: Date,
  handledOccurrenceKeys: Set<string>,
  graceMs: number
): Array<{ alarm: AlarmDefinition; occurrenceKey: string }> {
  const day = now.getDay();
  const due: Array<{ alarm: AlarmDefinition; occurrenceKey: string }> = [];
  for (const alarm of alarms) {
    if (!alarm || typeof alarm.id !== 'string') continue;
    if (!alarm.enabled) continue;
    if (!isValidTime(alarm.time)) continue;
    if (!isAlarmScheduledOnDay(alarm, day)) continue;
    if (!isWithinGraceWindow(now, alarm.time, graceMs)) continue;
    const key = occurrenceKey(alarm.id, now, alarm.time);
    if (handledOccurrenceKeys.has(key)) continue;
    due.push({ alarm, occurrenceKey: key });
  }
  return due;
}

export function snoozeFireAt(nowMs: number, minutes: number): number {
  return nowMs + minutes * 60_000;
}

export function coerceAlarm(raw: unknown): AlarmDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.label !== 'string') return null;
  if (typeof o.enabled !== 'boolean' || typeof o.time !== 'string') return null;
  if (!isValidTime(o.time)) return null;
  const toneId =
    o.toneId === 'chime' || o.toneId === 'bell' || o.toneId === 'radar' ? o.toneId : 'chime';
  return {
    id: o.id,
    label: o.label,
    enabled: o.enabled,
    time: o.time,
    days: normalizeDays(o.days),
    toneId,
  };
}

export function coerceAlarms(raw: unknown): AlarmDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceAlarm).filter((a): a is AlarmDefinition => a !== null);
}
