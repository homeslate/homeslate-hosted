import { describe, expect, it } from 'vitest';
import {
  createRuntimeFromFields,
  formatDurationMs,
  isRuntimeComplete,
  pauseRuntime,
  remainingMs,
  resumeRuntime,
} from './format';
import type { TimerRuntime } from './types';

describe('formatDurationMs', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatDurationMs(0)).toBe('0:00');
    expect(formatDurationMs(5_000)).toBe('0:05');
    expect(formatDurationMs(65_000)).toBe('1:05');
    expect(formatDurationMs(8 * 60_000)).toBe('8:00');
  });
  it('formats an hour or more as h:mm:ss', () => {
    expect(formatDurationMs(3_661_000)).toBe('1:01:01');
  });
  it('floors partial seconds and clamps negative to 0', () => {
    expect(formatDurationMs(1_999)).toBe('0:01');
    expect(formatDurationMs(-100)).toBe('0:00');
  });
});

describe('remaining / pause / resume / complete', () => {
  const running = (overrides: Partial<TimerRuntime> = {}): TimerRuntime => ({
    id: 'r1',
    label: 'Pasta',
    durationSeconds: 60,
    toneId: 'chime',
    endsAt: 1_000_000 + 30_000,
    remainingMs: 30_000,
    status: 'running',
    ...overrides,
  });

  it('remainingMs uses endsAt while running', () => {
    expect(remainingMs(running(), 1_000_000 + 10_000)).toBe(20_000);
  });

  it('remainingMs uses remainingMs while paused', () => {
    expect(remainingMs(running({ status: 'paused', remainingMs: 12_000 }), 1_000_000)).toBe(12_000);
  });

  it('pause freezes remaining and sets paused', () => {
    const next = pauseRuntime(running(), 1_000_000 + 10_000);
    expect(next.status).toBe('paused');
    expect(next.remainingMs).toBe(20_000);
  });

  it('resume sets endsAt from remaining', () => {
    const paused = pauseRuntime(running(), 1_000_000 + 10_000);
    const next = resumeRuntime(paused, 2_000_000);
    expect(next.status).toBe('running');
    expect(next.endsAt).toBe(2_000_000 + 20_000);
  });

  it('isRuntimeComplete when remaining <= 0', () => {
    expect(isRuntimeComplete(running({ endsAt: 1_000_000 }), 1_000_000)).toBe(true);
    expect(isRuntimeComplete(running({ endsAt: 1_000_001 }), 1_000_000)).toBe(false);
  });

  it('createRuntimeFromFields rejects non-positive duration', () => {
    expect(
      createRuntimeFromFields({
        id: 'x',
        label: 'Bad',
        durationSeconds: 0,
        toneId: 'chime',
        nowMs: 1_000,
      }),
    ).toBeNull();
  });
});
