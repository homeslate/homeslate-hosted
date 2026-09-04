import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyUpdate,
  registerPwaUpdates,
  resetPwaUpdateForTests,
  setDisplaySession,
  subscribeToPendingUpdate,
} from './pwaUpdate';

afterEach(() => {
  resetPwaUpdateForTests();
});

describe('pwaUpdate coordinator', () => {
  it('quiet-activates when update arrives outside a display session', () => {
    const updateSW = vi.fn();
    const registerSW = vi.fn((opts: { onNeedRefresh?: () => void }) => {
      queueMicrotask(() => opts.onNeedRefresh?.());
      return updateSW;
    });

    setDisplaySession(false);
    registerPwaUpdates({ registerSW: registerSW as never, checkIntervalMs: 60_000 });

    return Promise.resolve().then(() => {
      expect(updateSW).toHaveBeenCalledWith(false);
    });
  });

  it('notifies subscribers and does not apply when display session is active', async () => {
    const updateSW = vi.fn();
    let onNeedRefresh: (() => void) | undefined;
    const registerSW = vi.fn((opts: { onNeedRefresh?: () => void }) => {
      onNeedRefresh = opts.onNeedRefresh;
      return updateSW;
    });

    setDisplaySession(true);
    registerPwaUpdates({ registerSW: registerSW as never });

    const listener = vi.fn();
    subscribeToPendingUpdate(listener);
    onNeedRefresh?.();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(updateSW).not.toHaveBeenCalled();

    applyUpdate(true);
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('invokes subscriber immediately if update is already pending in a display session', () => {
    const updateSW = vi.fn();
    let onNeedRefresh: (() => void) | undefined;
    const registerSW = vi.fn((opts: { onNeedRefresh?: () => void }) => {
      onNeedRefresh = opts.onNeedRefresh;
      return updateSW;
    });

    setDisplaySession(true);
    registerPwaUpdates({ registerSW: registerSW as never });
    onNeedRefresh?.();

    const listener = vi.fn();
    subscribeToPendingUpdate(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(updateSW).not.toHaveBeenCalled();
  });

  it('notifies when display session becomes active while update is pending', () => {
    const updateSW = vi.fn();
    let onNeedRefresh: (() => void) | undefined;
    const registerSW = vi.fn((opts: { onNeedRefresh?: () => void }) => {
      onNeedRefresh = opts.onNeedRefresh;
      return updateSW;
    });

    setDisplaySession(true);
    registerPwaUpdates({ registerSW: registerSW as never });
    onNeedRefresh?.();
    expect(updateSW).not.toHaveBeenCalled();

    setDisplaySession(false);

    const listener = vi.fn();
    subscribeToPendingUpdate(listener);
    expect(listener).not.toHaveBeenCalled();

    setDisplaySession(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
