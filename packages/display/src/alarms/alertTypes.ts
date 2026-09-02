import type { AlarmToneId } from './types';

export type AlertKind = 'alarm' | 'timer';

export interface AlertQueueItem {
  kind: AlertKind;
  id: string;
  label: string;
  subtitle: string;
  toneId: AlarmToneId;
  /** Present for kind === 'alarm' — used for snooze keying / disable filtering */
  alarmId?: string;
  timer?: {
    runId: string;
    durationSeconds: number;
    label: string;
    toneId: AlarmToneId;
    presetId?: string;
  };
}
