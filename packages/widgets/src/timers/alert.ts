import type { AlarmToneId } from '@homeslate/schema';

export type TimerAlertPayload = {
  kind: 'timer';
  id: string;
  label: string;
  subtitle: string;
  toneId: AlarmToneId;
  timer: {
    runId: string;
    durationSeconds: number;
    label: string;
    toneId: AlarmToneId;
    presetId?: string;
  };
};
