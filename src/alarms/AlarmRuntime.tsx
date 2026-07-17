import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlarmDefinition, SnoozeMinutes } from './types';
import { findDueAlarms, snoozeFireAt } from './schedule';
import { setAlarmToneDucked, startAlarmTone, stopAlarmTone } from './tones';
import { AlarmDialog } from './AlarmDialog';
import { useAlarmVoiceCommands } from '../voice/useAlarmVoiceCommands';
import type { AlertQueueItem } from './alertTypes';
import { dedupeEnqueue, timerSnoozesAfterDismiss } from './alertQueue';

const GRACE_MS = 60_000;
const TICK_MS = 1000;

interface Props {
  alarms: AlarmDefinition[];
  enabled?: boolean;
  voiceEnabled?: boolean;
  onRegisterEnqueue?: (enqueue: ((item: AlertQueueItem) => void) | null) => void;
  onTimerRestart?: (timer: NonNullable<AlertQueueItem['timer']>) => void;
}

export function AlertRuntime({
  alarms,
  enabled = true,
  voiceEnabled = false,
  onRegisterEnqueue,
  onTimerRestart,
}: Props) {
  const [queue, setQueue] = useState<AlertQueueItem[]>([]);
  const [showSnoozeChoices, setShowSnoozeChoices] = useState(false);
  const [muted, setMuted] = useState(false);
  const handledRef = useRef(new Set<string>());
  const snoozesRef = useRef<Record<string, number>>({});
  const timerSnoozesRef = useRef<
    Record<string, { fireAt: number; timer: NonNullable<AlertQueueItem['timer']> }>
  >({});
  const current = queue[0] ?? null;

  const enqueueOne = useCallback((item: AlertQueueItem) => {
    setQueue((prev) => dedupeEnqueue(prev, [item]));
  }, []);

  const enqueue = useCallback((items: AlertQueueItem[]) => {
    if (items.length > 0) setQueue((prev) => dedupeEnqueue(prev, items));
  }, []);

  useEffect(() => {
    if (!enabled) {
      onRegisterEnqueue?.(null);
      return;
    }

    onRegisterEnqueue?.(enqueueOne);
    return () => onRegisterEnqueue?.(null);
  }, [enabled, enqueueOne, onRegisterEnqueue]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      const now = new Date();
      const nowMs = now.getTime();

      for (const alarmId of Object.keys(snoozesRef.current)) {
        const def = alarms.find((alarm) => alarm.id === alarmId);
        if (!def || !def.enabled) delete snoozesRef.current[alarmId];
      }

      const snoozeDue: AlertQueueItem[] = [];
      for (const [alarmId, fireAt] of Object.entries(snoozesRef.current)) {
        if (fireAt > nowMs) continue;
        const alarm = alarms.find((definition) => definition.id === alarmId);
        delete snoozesRef.current[alarmId];
        if (!alarm || !alarm.enabled) continue;
        const occurrenceKey = `${alarmId}|snooze|${fireAt}`;
        if (handledRef.current.has(occurrenceKey)) continue;
        handledRef.current.add(occurrenceKey);
        snoozeDue.push({
          kind: 'alarm',
          id: occurrenceKey,
          label: alarm.label,
          subtitle: alarm.time,
          toneId: alarm.toneId,
          alarmId: alarm.id,
        });
      }

      for (const [runId, snooze] of Object.entries(timerSnoozesRef.current)) {
        if (snooze.fireAt > nowMs) continue;
        delete timerSnoozesRef.current[runId];
        snoozeDue.push({
          kind: 'timer',
          id: `${runId}|snooze|${snooze.fireAt}`,
          label: snooze.timer.label,
          subtitle: '0:00',
          toneId: snooze.timer.toneId,
          timer: snooze.timer,
        });
      }

      const scheduled = findDueAlarms(alarms, now, handledRef.current, GRACE_MS);
      for (const item of scheduled) handledRef.current.add(item.occurrenceKey);

      enqueue([
        ...snoozeDue,
        ...scheduled.map(({ alarm, occurrenceKey }) => ({
          kind: 'alarm' as const,
          id: occurrenceKey,
          label: alarm.label,
          subtitle: alarm.time,
          toneId: alarm.toneId,
          alarmId: alarm.id,
        })),
      ]);

      setQueue((prev) => {
        const next = prev.filter((item) => {
          if (item.kind !== 'alarm') return true;
          return alarms.some((alarm) => alarm.id === item.alarmId && alarm.enabled);
        });
        return next.length === prev.length ? prev : next;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [alarms, enabled, enqueue]);

  useEffect(() => {
    if (!enabled) {
      stopAlarmTone();
      setShowSnoozeChoices(false);
      setMuted(false);
      setQueue([]);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !current || muted) {
      stopAlarmTone();
      return;
    }
    void startAlarmTone(current.toneId);
    return () => stopAlarmTone();
  }, [enabled, current, muted]);

  useEffect(() => {
    setShowSnoozeChoices(false);
    setMuted(false);
  }, [current?.id]);

  const dismiss = useCallback((options?: { preserveTimerSnooze?: boolean }) => {
    stopAlarmTone();
    if (current?.kind === 'timer' && current.timer) {
      timerSnoozesRef.current = timerSnoozesAfterDismiss(
        timerSnoozesRef.current,
        current.timer.runId,
        options?.preserveTimerSnooze ?? false,
      );
    }
    setQueue((prev) => prev.slice(1));
  }, [current]);

  const snooze = useCallback(
    (minutes: SnoozeMinutes) => {
      if (!current) return;
      const fireAt = snoozeFireAt(Date.now(), minutes);
      if (current.kind === 'alarm' && current.alarmId) {
        snoozesRef.current[current.alarmId] = fireAt;
      } else if (current.kind === 'timer' && current.timer) {
        timerSnoozesRef.current[current.timer.runId] = { fireAt, timer: current.timer };
      }
      dismiss({ preserveTimerSnooze: true });
    },
    [current, dismiss],
  );

  const restart = useCallback(() => {
    if (current?.kind !== 'timer' || !current.timer || !onTimerRestart) return;
    onTimerRestart(current.timer);
    dismiss();
  }, [current, dismiss, onTimerRestart]);

  const voiceActive = Boolean(enabled && current);
  const { listening, unavailableReason } = useAlarmVoiceCommands({
    active: voiceActive,
    enabled: voiceEnabled,
    onDismiss: dismiss,
    onSnooze: snooze,
  });

  useEffect(() => {
    setAlarmToneDucked(listening && !muted);
    return () => setAlarmToneDucked(false);
  }, [listening, muted]);

  if (!enabled || !current) return null;

  return (
    <AlarmDialog
      label={current.label}
      time={current.subtitle}
      muted={muted}
      showSnoozeChoices={showSnoozeChoices}
      showRestart={current.kind === 'timer'}
      voiceListening={listening}
      voiceUnavailableReason={voiceEnabled ? unavailableReason : null}
      onToggleMute={() => setMuted((muted) => !muted)}
      onDismiss={dismiss}
      onOpenSnooze={() => setShowSnoozeChoices(true)}
      onSnooze={snooze}
      onRestart={restart}
    />
  );
}

export { AlertRuntime as AlarmRuntime };
