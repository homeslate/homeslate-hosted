import { describe, expect, it } from 'vitest';
import { displayCalendarWindow } from './displayCalendarWindow';

describe('displayCalendarWindow', () => {
  it('includes days before today', () => {
    const now = new Date('2026-10-04T15:00:00');
    const { timeMin, timeMax } = displayCalendarWindow(14, 7, now);
    expect(timeMin.toISOString()).toBe(new Date('2026-09-27T00:00:00').toISOString());
    expect(timeMax.toISOString()).toBe(new Date('2026-10-18T00:00:00').toISOString());
  });
});
