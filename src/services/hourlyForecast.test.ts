import { describe, expect, it } from 'vitest';
import { findHourlyStartIndex, sliceHourlyFromNow } from './hourlyForecast';

describe('findHourlyStartIndex', () => {
  it('returns index of current hour', () => {
    const times = [
      '2026-07-15T12:00',
      '2026-07-15T13:00',
      '2026-07-15T14:00',
      '2026-07-15T15:00',
    ];
    const now = new Date(2026, 6, 15, 14, 20, 0); // Jul 15 2026 2:20 PM local
    expect(findHourlyStartIndex(times, now)).toBe(2);
  });

  it('skips hours before now', () => {
    const times = [
      '2026-07-15T00:00',
      '2026-07-15T01:00',
      '2026-07-15T02:00',
    ];
    const now = new Date(2026, 6, 15, 2, 5, 0);
    expect(findHourlyStartIndex(times, now)).toBe(2);
  });

  it('returns length when all hours are in the past', () => {
    const times = ['2026-07-15T00:00', '2026-07-15T01:00'];
    const now = new Date(2026, 6, 15, 14, 0, 0);
    expect(findHourlyStartIndex(times, now)).toBe(2);
  });
});

describe('sliceHourlyFromNow', () => {
  it('returns up to count when more hours exist', () => {
    const times = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(2026, 6, 15, 0, 0, 0);
      d.setHours(i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:00`;
    });
    const values = times.map((_, i) => i);
    const now = new Date(2026, 6, 15, 14, 20, 0);
    expect(sliceHourlyFromNow({ times, values, now, count: 12 })).toEqual([
      14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    ]);
  });

  it('returns fewer than count near end of feed', () => {
    const times = ['2026-07-15T22:00', '2026-07-15T23:00'];
    const values = ['a', 'b'];
    const now = new Date(2026, 6, 15, 22, 10, 0);
    expect(sliceHourlyFromNow({ times, values, now, count: 12 })).toEqual(['a', 'b']);
  });

  it('returns empty when times empty', () => {
    expect(sliceHourlyFromNow({ times: [], values: [], now: new Date(), count: 12 })).toEqual([]);
  });
});
