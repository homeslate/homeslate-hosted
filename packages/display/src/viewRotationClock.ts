export type ViewRotationSync = {
  enabled: boolean;
  intervalMs: number;
  visibleCount: number;
  onRotate: () => void;
};

/**
 * Display view auto-rotation timer.
 *
 * Config polling rebuilds callbacks frequently. Syncing with a new `onRotate`
 * (same settings) must not restart the countdown — otherwise the progress
 * ring resets mid-cycle and the view can stall indefinitely.
 */
export function createViewRotationClock() {
  let timer: ReturnType<typeof setInterval> | null = null;
  let onRotate: () => void = () => {};
  let last: { enabled: boolean; intervalMs: number; visibleCount: number } | null = null;
  let progressGeneration = 0;

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const shouldRun = (s: ViewRotationSync) => s.enabled && s.visibleCount > 1;

  const start = (intervalMs: number) => {
    stop();
    timer = setInterval(() => onRotate(), intervalMs);
    progressGeneration += 1;
  };

  const remember = (s: ViewRotationSync) => {
    onRotate = s.onRotate;
    last = { enabled: s.enabled, intervalMs: s.intervalMs, visibleCount: s.visibleCount };
  };

  const settingsChanged = (s: ViewRotationSync) =>
    !last ||
    last.enabled !== s.enabled ||
    last.intervalMs !== s.intervalMs ||
    last.visibleCount !== s.visibleCount;

  const sync = (s: ViewRotationSync) => {
    const restart = settingsChanged(s) || timer === null;
    remember(s);
    if (!shouldRun(s)) {
      stop();
      return;
    }
    if (restart) {
      start(s.intervalMs);
    }
  };

  const reset = (s: ViewRotationSync) => {
    remember(s);
    if (!shouldRun(s)) {
      stop();
      return;
    }
    start(s.intervalMs);
  };

  return {
    sync,
    reset,
    stop,
    getProgressGeneration: () => progressGeneration,
  };
}
