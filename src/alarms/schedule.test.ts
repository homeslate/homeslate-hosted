import { describe, expect, it } from 'vitest';
import {
  findDueAlarms,
  isAlarmScheduledOnDay,
  isValidTime,
  isWithinGraceWindow,
  normalizeDays,
  occurrenceKey,
  snoozeFireAt,
} from './schedule';
import type { AlarmDefinition } from './types';

const base = (overrides: Partial<AlarmDefinition> = {}): AlarmDefinition => ({
  id: 'a1',
  label: 'Dinner',
  enabled: true,
  time: '19:00',
  days: [0, 1, 2, 3, 4, 5, 6],
  toneId: 'chime',
  ...overrides,
});

describe('isValidTime', () => {
  it('accepts HH:mm', () => {
    expect(isValidTime('07:30')).toBe(true);
    expect(isValidTime('19:00')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isValidTime('9:00')).toBe(false);
    expect(isValidTime('25:00')).toBe(false);
    expect(isValidTime('')).toBe(false);
  });
});

describe('normalizeDays / isAlarmScheduledOnDay', () => {
  it('treats empty days as every day', () => {
    expect(normalizeDays([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(isAlarmScheduledOnDay(base({ days: [] }), 3)).toBe(true);
  });
  it('respects weekday subset', () => {
    expect(isAlarmScheduledOnDay(base({ days: [1, 2, 3, 4, 5] }), 0)).toBe(false);
    expect(isAlarmScheduledOnDay(base({ days: [1, 2, 3, 4, 5] }), 1)).toBe(true);
  });
});

describe('occurrenceKey', () => {
  it('includes id date and time', () => {
    const d = new Date(2026, 6, 14, 19, 0, 0); // Jul 14 2026 local
    expect(occurrenceKey('a1', d, '19:00')).toBe('a1|2026-07-14|19:00');
  });
});

describe('isWithinGraceWindow', () => {
  it('accepts within 60s after target minute', () => {
    const now = new Date(2026, 6, 14, 19, 0, 45);
    expect(isWithinGraceWindow(now, '19:00', 60_000)).toBe(true);
  });
  it('rejects before target and after grace', () => {
    expect(isWithinGraceWindow(new Date(2026, 6, 14, 18, 59, 59), '19:00', 60_000)).toBe(false);
    expect(isWithinGraceWindow(new Date(2026, 6, 14, 19, 1, 1), '19:00', 60_000)).toBe(false);
  });
});

describe('findDueAlarms', () => {
  it('returns due enabled alarms not already handled', () => {
    const now = new Date(2026, 6, 14, 19, 0, 10); // Tuesday
    const alarms = [
      base({ id: 'a1', time: '19:00' }),
      base({ id: 'a2', time: '19:00', enabled: false }),
      base({ id: 'a3', time: '07:00' }),
    ];
    const handled = new Set<string>();
    const due = findDueAlarms(alarms, now, handled, 60_000);
    expect(due.map((d) => d.alarm.id)).toEqual(['a1']);
    expect(due[0].occurrenceKey).toBe('a1|2026-07-14|19:00');
  });
  it('skips handled occurrence keys', () => {
    const now = new Date(2026, 6, 14, 19, 0, 10);
    const handled = new Set(['a1|2026-07-14|19:00']);
    expect(findDueAlarms([base()], now, handled, 60_000)).toEqual([]);
  });
  it('skips invalid time entries', () => {
    const now = new Date(2026, 6, 14, 19, 0, 10);
    expect(findDueAlarms([base({ time: 'nope' })], now, new Set(), 60_000)).toEqual([]);
  });
});

describe('snoozeFireAt', () => {
  it('adds minutes to now', () => {
    const now = new Date(2026, 6, 14, 19, 0, 0).getTime();
    expect(snoozeFireAt(now, 10)).toBe(now + 10 * 60_000);
  });
});
