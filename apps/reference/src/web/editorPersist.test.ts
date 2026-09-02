import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedPersist } from './editorPersist';

afterEach(() => {
  vi.useRealTimers();
});

describe('createDebouncedPersist', () => {
  it('does not persist until the debounce delay elapses, without keepalive', () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const persist = createDebouncedPersist(put, 400);

    persist.schedule({ name: 'Kitchen' });
    vi.advanceTimersByTime(399);
    expect(put).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith({ name: 'Kitchen' }, { keepalive: false });
  });

  it('flushes a pending persist immediately so unmount does not drop the last edit', () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const persist = createDebouncedPersist(put, 400);

    persist.schedule({ name: 'Kitchen' });
    persist.flush();

    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith({ name: 'Kitchen' }, { keepalive: false });
    vi.advanceTimersByTime(400);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('flushes a pending persist on pagehide with keepalive so reload can deliver the last edit', () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const unloadTarget = new EventTarget();
    const persist = createDebouncedPersist(put, 400, { unloadTarget });
    const detach = persist.attach();

    persist.schedule({ name: 'Kitchen' });
    unloadTarget.dispatchEvent(new Event('pagehide'));

    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith({ name: 'Kitchen' }, { keepalive: true });
    detach();
  });

  it('does not flush on unload events before attach or after detach', () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const unloadTarget = new EventTarget();
    const persist = createDebouncedPersist(put, 400, { unloadTarget });

    persist.schedule({ name: 'Kitchen' });
    unloadTarget.dispatchEvent(new Event('pagehide'));
    expect(put).not.toHaveBeenCalled();

    const detach = persist.attach();
    detach();
    unloadTarget.dispatchEvent(new Event('beforeunload'));
    expect(put).not.toHaveBeenCalled();
  });

  it('re-attaches after a detach so StrictMode double-invoke keeps the unload flush', () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const unloadTarget = new EventTarget();
    const persist = createDebouncedPersist(put, 400, { unloadTarget });

    persist.attach()();
    const detach = persist.attach();

    persist.schedule({ name: 'Kitchen' });
    unloadTarget.dispatchEvent(new Event('pagehide'));

    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith({ name: 'Kitchen' }, { keepalive: true });
    detach();
  });
});
