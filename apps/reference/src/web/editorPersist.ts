export type PersistPutOptions = { keepalive: boolean };

export type DebouncedPersist<T> = {
  schedule: (value: T) => void;
  flush: () => void;
  dispose: () => void;
};

export function createDebouncedPersist<T>(
  put: (value: T, options: PersistPutOptions) => void,
  delayMs: number,
  options?: { unloadTarget?: EventTarget },
): DebouncedPersist<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;
  const unloadTarget =
    options?.unloadTarget ?? (typeof window === 'undefined' ? undefined : window);

  const commit = (options: PersistPutOptions) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending === null) return;
    const value = pending;
    pending = null;
    put(value, options);
  };

  const flush = () => commit({ keepalive: false });
  const flushUnload = () => commit({ keepalive: true });

  unloadTarget?.addEventListener('pagehide', flushUnload);
  unloadTarget?.addEventListener('beforeunload', flushUnload);

  return {
    schedule(value: T) {
      pending = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    dispose() {
      unloadTarget?.removeEventListener('pagehide', flushUnload);
      unloadTarget?.removeEventListener('beforeunload', flushUnload);
    },
  };
}
