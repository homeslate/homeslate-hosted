import type { AlarmToneId } from '../alarms/types';
import type { TimerPreset, TimerRuntime } from './types';

export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  }
  return `${m}:${ss}`;
}

export function remainingMs(runtime: TimerRuntime, nowMs: number): number {
  if (runtime.status === 'paused') return Math.max(0, runtime.remainingMs);
  return Math.max(0, runtime.endsAt - nowMs);
}

export function pauseRuntime(runtime: TimerRuntime, nowMs: number): TimerRuntime {
  if (runtime.status === 'paused') return runtime;
  return {
    ...runtime,
    status: 'paused',
    remainingMs: remainingMs(runtime, nowMs),
  };
}

export function resumeRuntime(runtime: TimerRuntime, nowMs: number): TimerRuntime {
  if (runtime.status === 'running') return runtime;
  const left = Math.max(0, runtime.remainingMs);
  return {
    ...runtime,
    status: 'running',
    remainingMs: left,
    endsAt: nowMs + left,
  };
}

export function isRuntimeComplete(runtime: TimerRuntime, nowMs: number): boolean {
  return remainingMs(runtime, nowMs) <= 0;
}

export function createRuntimeFromFields(args: {
  id: string;
  label: string;
  durationSeconds: number;
  toneId: AlarmToneId;
  nowMs: number;
  presetId?: string;
}): TimerRuntime | null {
  const { id, label, durationSeconds, toneId, nowMs, presetId } = args;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const ms = Math.round(durationSeconds * 1000);
  return {
    id,
    presetId,
    label: label.trim() || 'Timer',
    durationSeconds,
    toneId,
    endsAt: nowMs + ms,
    remainingMs: ms,
    status: 'running',
  };
}

export function createRuntimeFromPreset(
  preset: TimerPreset,
  id: string,
  nowMs: number,
): TimerRuntime | null {
  return createRuntimeFromFields({
    id,
    presetId: preset.id,
    label: preset.label,
    durationSeconds: preset.durationSeconds,
    toneId: preset.toneId,
    nowMs,
  });
}
