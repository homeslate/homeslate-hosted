import type { AlarmToneId } from '@homeslate/schema';

export interface TimerPreset {
  id: string;
  label: string;
  durationSeconds: number;
  toneId: AlarmToneId;
}

export interface TimerRuntime {
  id: string;
  presetId?: string;
  label: string;
  durationSeconds: number;
  toneId: AlarmToneId;
  endsAt: number;
  remainingMs: number;
  status: 'running' | 'paused';
}

export interface TimersWidgetConfig {
  presets: TimerPreset[];
  transparentBackground?: boolean;
  [key: string]: unknown;
}
