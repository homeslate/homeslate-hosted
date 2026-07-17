import { describe, expect, it } from 'vitest';
import { dedupeEnqueue } from './alertQueue';
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
