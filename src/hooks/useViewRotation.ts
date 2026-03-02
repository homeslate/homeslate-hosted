import { useEffect, useRef, useCallback } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

/**
 * Manages auto-rotation between views for the selected display.
 * Returns resetTimer() so callers (e.g. swipe handler) can restart the
 * countdown after a manual navigation.
 */
export function useViewRotation() {
  const { displays, selectedDisplayId, navigateToView } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);

  const rotationEnabled = display?.rotationEnabled ?? false;
  const rotationIntervalMs = display?.rotationIntervalMs ?? 30000;
  const layoutCount = display?.layouts.length ?? 0;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    if (!rotationEnabled || layoutCount <= 1) return;
    timerRef.current = setInterval(() => {
      navigateToView('next');
    }, rotationIntervalMs);
  }, [rotationEnabled, layoutCount, rotationIntervalMs, navigateToView, stopTimer]);

  useEffect(() => {
    startTimer();
    return stopTimer;
  }, [startTimer, stopTimer]);

  const resetTimer = useCallback(() => {
    startTimer();
  }, [startTimer]);

  return { resetTimer };
}
