import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AlertQueueItem } from '../alarms/alertTypes';
import type { AlarmToneId } from '../alarms/types';
import {
  createRuntimeFromFields,
  createRuntimeFromPreset,
  isRuntimeComplete,
  pauseRuntime,
  remainingMs,
  resumeRuntime,
} from './format';
import type { TimerPreset, TimerRuntime } from './types';

type EnqueueFn = (item: AlertQueueItem) => void;

interface TimersContextValue {
  runtimes: TimerRuntime[];
  startFromPreset: (preset: TimerPreset) => void;
  startFromFields: (fields: { label: string; durationSeconds: number; toneId: AlarmToneId }) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  cancel: (id: string) => void;
  registerEnqueue: (fn: EnqueueFn | null) => void;
  restartFromAlert: (timer: NonNullable<AlertQueueItem['timer']>) => void;
}

const TimersContext = createContext<TimersContextValue | null>(null);

export function TimersProvider({ children }: { children: ReactNode }) {
  const [runtimes, setRuntimes] = useState<TimerRuntime[]>([]);
  const enqueueRef = useRef<EnqueueFn | null>(null);
  const completedRef = useRef(new Set<string>());

  const registerEnqueue = useCallback((fn: EnqueueFn | null) => {
    enqueueRef.current = fn;
  }, []);

  const startFromFields = useCallback(
    (fields: { label: string; durationSeconds: number; toneId: AlarmToneId; presetId?: string }) => {
      const runtime = createRuntimeFromFields({
        id: uuidv4(),
        nowMs: Date.now(),
        ...fields,
      });
      if (!runtime) return;
      setRuntimes((prev) => [...prev, runtime]);
    },
    [],
  );

  const startFromPreset = useCallback((preset: TimerPreset) => {
    const runtime = createRuntimeFromPreset(preset, uuidv4(), Date.now());
    if (!runtime) return;
    setRuntimes((prev) => [...prev, runtime]);
  }, []);

  const restartFromAlert = useCallback(
    (timer: NonNullable<AlertQueueItem['timer']>) => {
      startFromFields({
        label: timer.label,
        durationSeconds: timer.durationSeconds,
        toneId: timer.toneId,
        presetId: timer.presetId,
      });
    },
    [startFromFields],
  );

  const pause = useCallback((id: string) => {
    const now = Date.now();
    setRuntimes((prev) => prev.map((runtime) => (runtime.id === id ? pauseRuntime(runtime, now) : runtime)));
  }, []);

  const resume = useCallback((id: string) => {
    const now = Date.now();
    setRuntimes((prev) => prev.map((runtime) => (runtime.id === id ? resumeRuntime(runtime, now) : runtime)));
  }, []);

  const cancel = useCallback((id: string) => {
    completedRef.current.delete(id);
    setRuntimes((prev) => prev.filter((runtime) => runtime.id !== id));
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const now = Date.now();
      setRuntimes((prev) => {
        const stillRunning: TimerRuntime[] = [];

        for (const runtime of prev) {
          if (runtime.status === 'paused') {
            stillRunning.push(runtime);
            continue;
          }

          if (!isRuntimeComplete(runtime, now)) {
            stillRunning.push({ ...runtime, remainingMs: remainingMs(runtime, now) });
            continue;
          }

          if (completedRef.current.has(runtime.id)) continue;
          completedRef.current.add(runtime.id);
          enqueueRef.current?.({
            kind: 'timer',
            id: `timer|${runtime.id}`,
            label: runtime.label,
            subtitle: '0:00',
            toneId: runtime.toneId,
            timer: {
              runId: runtime.id,
              durationSeconds: runtime.durationSeconds,
              label: runtime.label,
              toneId: runtime.toneId,
              presetId: runtime.presetId,
            },
          });
        }

        return stillRunning;
      });
    }, 250);

    return () => window.clearInterval(tick);
  }, []);

  const value: TimersContextValue = {
    runtimes,
    startFromPreset,
    startFromFields,
    pause,
    resume,
    cancel,
    registerEnqueue,
    restartFromAlert,
  };

  return <TimersContext.Provider value={value}>{children}</TimersContext.Provider>;
}

export function useTimers(): TimersContextValue {
  const context = useContext(TimersContext);
  if (!context) {
    throw new Error('useTimers must be used within TimersProvider');
  }
  return context;
}
