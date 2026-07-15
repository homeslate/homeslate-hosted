import { describe, expect, it } from 'vitest';
import { findHourlyStartIndex, sliceHourlyFromNow } from './hourlyForecast';

// These tests construct `now` as a local Date (device timezone) and derive
// `utcOffsetSeconds` from that same local timezone, so the "wall time" in the
// naive time strings lines up with the device's own local hour. This keeps
// the original test intent (comparisons against the device's local clock)
// while exercising the new explicit-offset API.
function deviceUtcOffsetSeconds(): number {
  return new Date().getTimezoneOffset() * -60;
}

describe('findHourlyStartIndex', () => {
  it('returns index of current hour', () => {
    const times = [
      '2026-07-15T12:00',
      '2026-07-15T13:00',
      '2026-07-15T14:00',
      '2026-07-15T15:00',
    ];
    const now = new Date(2026, 6, 15, 14, 20, 0); // Jul 15 2026 2:20 PM local
    expect(findHourlyStartIndex(times, now, deviceUtcOffsetSeconds())).toBe(2);
  });

  it('skips hours before now', () => {
    const times = [
      '2026-07-15T00:00',
      '2026-07-15T01:00',
      '2026-07-15T02:00',
    ];
    const now = new Date(2026, 6, 15, 2, 5, 0);
    expect(findHourlyStartIndex(times, now, deviceUtcOffsetSeconds())).toBe(2);
  });

  it('returns length when all hours are in the past', () => {
    const times = ['2026-07-15T00:00', '2026-07-15T01:00'];
    const now = new Date(2026, 6, 15, 14, 0, 0);
    expect(findHourlyStartIndex(times, now, deviceUtcOffsetSeconds())).toBe(2);
  });

  it('uses the provided offset instead of the device local timezone', () => {
    // America/New_York on Jul 15 2026 is EDT (UTC-4 = -14400s). Times below
    // are New York wall times. `now` is chosen so that, regardless of the
    // machine running this test, the NY wall clock reads 17:20 -> start index
    // should land on the 17:00 slot.
    const utcOffsetSeconds = -14400;
    const times = [
      '2026-07-15T15:00',
      '2026-07-15T16:00',
      '2026-07-15T17:00',
      '2026-07-15T18:00',
    ];
    // 17:20 NY wall time -> UTC instant is 21:20 UTC (17:20 + 4h).
    const now = new Date(Date.UTC(2026, 6, 15, 21, 20, 0));
    expect(findHourlyStartIndex(times, now, utcOffsetSeconds)).toBe(2);
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
    expect(
      sliceHourlyFromNow({ times, values, now, utcOffsetSeconds: deviceUtcOffsetSeconds(), count: 12 }),
    ).toEqual([14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
  });

  it('returns fewer than count near end of feed', () => {
    const times = ['2026-07-15T22:00', '2026-07-15T23:00'];
    const values = ['a', 'b'];
    const now = new Date(2026, 6, 15, 22, 10, 0);
    expect(
      sliceHourlyFromNow({ times, values, now, utcOffsetSeconds: deviceUtcOffsetSeconds(), count: 12 }),
    ).toEqual(['a', 'b']);
  });

  it('returns empty when times empty', () => {
    expect(
      sliceHourlyFromNow({ times: [], values: [], now: new Date(), utcOffsetSeconds: 0, count: 12 }),
    ).toEqual([]);
  });

  it('slices using the provided location offset, not the device timezone', () => {
    const utcOffsetSeconds = -14400; // America/New_York (EDT)
    const times = [
      '2026-07-15T15:00',
      '2026-07-15T16:00',
      '2026-07-15T17:00',
      '2026-07-15T18:00',
      '2026-07-15T19:00',
    ];
    const values = ['15h', '16h', '17h', '18h', '19h'];
    const now = new Date(Date.UTC(2026, 6, 15, 21, 20, 0)); // 17:20 NY wall time
    expect(sliceHourlyFromNow({ times, values, now, utcOffsetSeconds, count: 3 })).toEqual([
      '17h',
      '18h',
      '19h',
    ]);
  });
});
