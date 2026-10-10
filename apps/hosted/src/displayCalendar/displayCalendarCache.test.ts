import { describe, expect, it } from 'vitest';
import {
  DISPLAY_CALENDAR_CLIENT_TTL_MS,
  isDisplayCalendarCacheFresh,
} from './displayCalendarCache';

describe('isDisplayCalendarCacheFresh', () => {
  it('is fresh inside TTL', () => {
    const now = 1_000_000;
    expect(isDisplayCalendarCacheFresh(now - DISPLAY_CALENDAR_CLIENT_TTL_MS + 1, now)).toBe(true);
  });

  it('is stale at or beyond TTL', () => {
    const now = 1_000_000;
    expect(isDisplayCalendarCacheFresh(now - DISPLAY_CALENDAR_CLIENT_TTL_MS, now)).toBe(false);
  });
});
