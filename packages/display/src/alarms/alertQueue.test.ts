import { describe, expect, it } from 'vitest';
import { dedupeEnqueue, timerSnoozesAfterDismiss } from './alertQueue';
import type { AlertQueueItem } from './alertTypes';

const item = (id: string): AlertQueueItem => ({
  kind: 'timer',
  id,
  label: 'Tea',
  subtitle: '0:00',
  toneId: 'chime',
});

describe('dedupeEnqueue', () => {
  it('skips duplicate ids while retaining order', () => {
    const next = dedupeEnqueue([item('a')], [item('a'), item('b'), item('b')]);

    expect(next.map((alert) => alert.id)).toEqual(['a', 'b']);
  });
});

describe('timerSnoozesAfterDismiss', () => {
  it('retains a timer snooze scheduled before snoozing dismisses the active alert', () => {
    const snoozes = {
      run_1: {
        fireAt: 1_000,
        timer: {
          runId: 'run_1',
          durationSeconds: 60,
          label: 'Tea',
          toneId: 'chime' as const,
        },
      },
    };

    expect(timerSnoozesAfterDismiss(snoozes, 'run_1', true)).toEqual(snoozes);
  });

  it('clears a pending timer snooze on an explicit dismiss', () => {
    const snoozes = {
      run_1: {
        fireAt: 1_000,
        timer: {
          runId: 'run_1',
          durationSeconds: 60,
          label: 'Tea',
          toneId: 'chime' as const,
        },
      },
    };

    expect(timerSnoozesAfterDismiss(snoozes, 'run_1', false)).toEqual({});
  });
});
