import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewRotationClock } from './viewRotationClock';

describe('createViewRotationClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rotates when the interval elapses', () => {
    const onRotate = vi.fn();
    const clock = createViewRotationClock();
    clock.sync({ enabled: true, intervalMs: 60_000, visibleCount: 2, onRotate });

    vi.advanceTimersByTime(59_999);
    expect(onRotate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onRotate).toHaveBeenCalledTimes(1);
  });

  it('keeps the original deadline when resynced with a new callback (display config poll)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const clock = createViewRotationClock();

    clock.sync({ enabled: true, intervalMs: 60_000, visibleCount: 2, onRotate: first });
    vi.advanceTimersByTime(30_000);

    // Poll delivers a new config object and a new navigate callback without
    // changing rotation settings. The countdown must not restart.
    clock.sync({ enabled: true, intervalMs: 60_000, visibleCount: 2, onRotate: second });
    expect(clock.getProgressGeneration()).toBe(1);

    vi.advanceTimersByTime(29_999);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('restarts the countdown on an explicit reset', () => {
    const onRotate = vi.fn();
    const clock = createViewRotationClock();
    clock.sync({ enabled: true, intervalMs: 30_000, visibleCount: 2, onRotate });

    vi.advanceTimersByTime(20_000);
    clock.reset({ enabled: true, intervalMs: 30_000, visibleCount: 2, onRotate });
    expect(clock.getProgressGeneration()).toBe(2);

    vi.advanceTimersByTime(20_000);
    expect(onRotate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(onRotate).toHaveBeenCalledTimes(1);
  });

  it('restarts when the rotation interval changes', () => {
    const onRotate = vi.fn();
    const clock = createViewRotationClock();
    clock.sync({ enabled: true, intervalMs: 30_000, visibleCount: 2, onRotate });

    vi.advanceTimersByTime(20_000);
    clock.sync({ enabled: true, intervalMs: 60_000, visibleCount: 2, onRotate });
    expect(clock.getProgressGeneration()).toBe(2);

    vi.advanceTimersByTime(30_000);
    expect(onRotate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30_000);
    expect(onRotate).toHaveBeenCalledTimes(1);
  });

  it('does not rotate when disabled or only one view is visible', () => {
    const onRotate = vi.fn();
    const clock = createViewRotationClock();

    clock.sync({ enabled: false, intervalMs: 1_000, visibleCount: 3, onRotate });
    vi.advanceTimersByTime(5_000);
    expect(onRotate).not.toHaveBeenCalled();

    clock.sync({ enabled: true, intervalMs: 1_000, visibleCount: 1, onRotate });
    vi.advanceTimersByTime(5_000);
    expect(onRotate).not.toHaveBeenCalled();
  });
});
