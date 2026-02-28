import { useEffect, useRef, useCallback } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

/**
 * Manages auto-rotation between views.
 * Returns resetTimer() so callers (e.g. swipe handler) can restart the
 * countdown after a manual navigation — preventing an immediate auto-advance.
 */
export function useViewRotation() {
  const { layouts, rotationEnabled, rotationIntervalMs, isEditing, navigateToView } =
    useDashboardStore();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    if (!rotationEnabled || isEditing || layouts.length <= 1) return;
    timerRef.current = setInterval(() => {
      navigateToView('next');
    }, rotationIntervalMs);
  }, [rotationEnabled, isEditing, layouts.length, rotationIntervalMs, navigateToView, stopTimer]);

  useEffect(() => {
    startTimer();
    return stopTimer;
  }, [startTimer, stopTimer]);

  // Call after a manual swipe to reset the countdown
  const resetTimer = useCallback(() => {
    startTimer();
  }, [startTimer]);

  return { resetTimer };
}
