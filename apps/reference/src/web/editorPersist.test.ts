import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedPersist } from './editorPersist';

afterEach(() => {
  vi.useRealTimers();
});

describe('createDebouncedPersist', () => {
  it('does not persist until the debounce delay elapses', () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const persist = createDebouncedPersist(put, 400);

    persist.schedule({ name: 'Kitchen' });
    vi.advanceTimersByTime(399);
    expect(put).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith({ name: 'Kitchen' });
  });

  it('flushes a pending persist immediately so unmount does not drop the last edit', () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const persist = createDebouncedPersist(put, 400);

    persist.schedule({ name: 'Kitchen' });
    persist.flush();

    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith({ name: 'Kitchen' });
    vi.advanceTimersByTime(400);
    expect(put).toHaveBeenCalledTimes(1);
  });
});
