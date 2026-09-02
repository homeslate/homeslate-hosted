export type DebouncedPersist<T> = {
  schedule: (value: T) => void;
  flush: () => void;
  dispose: () => void;
};

export function createDebouncedPersist<T>(
  put: (value: T) => void,
  delayMs: number,
  options?: { unloadTarget?: EventTarget },
): DebouncedPersist<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;
  const unloadTarget =
    options?.unloadTarget ?? (typeof window === 'undefined' ? undefined : window);

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending === null) return;
    const value = pending;
    pending = null;
    put(value);
  };

  unloadTarget?.addEventListener('pagehide', flush);
  unloadTarget?.addEventListener('beforeunload', flush);

  return {
    schedule(value: T) {
      pending = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    dispose() {
      unloadTarget?.removeEventListener('pagehide', flush);
      unloadTarget?.removeEventListener('beforeunload', flush);
    },
  };
}
