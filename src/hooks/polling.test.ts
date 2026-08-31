import { describe, expect, it } from 'vitest';
import { getDisplayCalendarPollDelay, getNextPollDelay } from './polling';

describe('getNextPollDelay', () => {
  it('uses the normal interval when there are no failures', () => {
    expect(getNextPollDelay(300_000, 0)).toBe(300_000);
  });

  it('retries faster after a network failure', () => {
    expect(getNextPollDelay(300_000, 1)).toBe(5_000);
  });
});

describe('getDisplayCalendarPollDelay', () => {
  it('backs off for 30 minutes after a revoked Google token', () => {
    expect(getDisplayCalendarPollDelay(300_000, 0, true)).toBe(30 * 60 * 1000);
  });

  it('keeps the normal cadence when auth is not fatal', () => {
    expect(getDisplayCalendarPollDelay(300_000, 0, false)).toBe(300_000);
  });
});
