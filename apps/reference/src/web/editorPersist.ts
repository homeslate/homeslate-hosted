export function createDebouncedPersist<T>(
  put: (value: T) => void,
  delayMs: number,
): { schedule: (value: T) => void; flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;

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

  return {
    schedule(value: T) {
      pending = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}
