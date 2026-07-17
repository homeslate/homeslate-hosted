import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
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

interface TimersState {
  runtimes: TimerRuntime[];
  pendingCompletions: TimerRuntime[];
}

type TimersAction =
  | { type: 'start'; runtime: TimerRuntime }
  | { type: 'pause'; id: string; now: number }
  | { type: 'resume'; id: string; now: number }
  | { type: 'cancel'; id: string }
  | { type: 'tick'; now: number }
  | { type: 'flush-completions'; ids: string[] };

function withCompletedRuntimes(state: TimersState, runtimes: TimerRuntime[], completed: TimerRuntime[]): TimersState {
  if (completed.length === 0) return { ...state, runtimes };

  const pendingIds = new Set(state.pendingCompletions.map((runtime) => runtime.id));
  return {
    runtimes,
    pendingCompletions: [...state.pendingCompletions, ...completed.filter((runtime) => !pendingIds.has(runtime.id))],
  };
}

function timersReducer(state: TimersState, action: TimersAction): TimersState {
  switch (action.type) {
    case 'start':
      return { ...state, runtimes: [...state.runtimes, action.runtime] };
    case 'resume':
      return {
        ...state,
        runtimes: state.runtimes.map((runtime) => (runtime.id === action.id ? resumeRuntime(runtime, action.now) : runtime)),
      };
    case 'cancel':
      return {
        runtimes: state.runtimes.filter((runtime) => runtime.id !== action.id),
        pendingCompletions: state.pendingCompletions.filter((runtime) => runtime.id !== action.id),
      };
    case 'pause': {
      const completed: TimerRuntime[] = [];
      const runtimes = state.runtimes.flatMap((runtime) => {
        if (runtime.id !== action.id) return [runtime];
        const paused = pauseRuntime(runtime, action.now);
        if (isRuntimeComplete(paused, action.now)) {
          completed.push(paused);
          return [];
        }
        return [paused];
      });
      return withCompletedRuntimes(state, runtimes, completed);
    }
    case 'tick': {
      const completed: TimerRuntime[] = [];
      const runtimes = state.runtimes.flatMap((runtime) => {
        if (isRuntimeComplete(runtime, action.now)) {
          completed.push(runtime);
          return [];
        }
        if (runtime.status === 'paused') return [runtime];
        return [{ ...runtime, remainingMs: remainingMs(runtime, action.now) }];
      });
      return withCompletedRuntimes(state, runtimes, completed);
    }
    case 'flush-completions': {
      const ids = new Set(action.ids);
      return { ...state, pendingCompletions: state.pendingCompletions.filter((runtime) => !ids.has(runtime.id)) };
    }
  }
}

export function TimersProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(timersReducer, { runtimes: [], pendingCompletions: [] });
  const { runtimes } = state;
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
      dispatch({ type: 'start', runtime });
    },
    [],
  );

  const startFromPreset = useCallback((preset: TimerPreset) => {
    const runtime = createRuntimeFromPreset(preset, uuidv4(), Date.now());
    if (!runtime) return;
    dispatch({ type: 'start', runtime });
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

  const resume = useCallback((id: string) => {
    dispatch({ type: 'resume', id, now: Date.now() });
  }, []);

  const cancel = useCallback((id: string) => {
    completedRef.current.delete(id);
    dispatch({ type: 'cancel', id });
  }, []);

  const enqueueCompletion = useCallback((runtime: TimerRuntime) => {
    if (completedRef.current.has(runtime.id)) return;
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
  }, []);

  const pause = useCallback((id: string) => {
    dispatch({ type: 'pause', id, now: Date.now() });
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      dispatch({ type: 'tick', now: Date.now() });
    }, 250);

    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (state.pendingCompletions.length === 0) return;
    state.pendingCompletions.forEach(enqueueCompletion);
    dispatch({ type: 'flush-completions', ids: state.pendingCompletions.map((runtime) => runtime.id) });
  }, [enqueueCompletion, state.pendingCompletions]);

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
