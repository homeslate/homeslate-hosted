import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlarmDefinition, SnoozeMinutes } from './types';
import { findDueAlarms, snoozeFireAt } from './schedule';
import { startAlarmTone, stopAlarmTone } from './tones';
import { AlarmDialog } from './AlarmDialog';

const GRACE_MS = 60_000;
const TICK_MS = 1000;

interface QueueItem {
  alarm: AlarmDefinition;
  occurrenceKey: string;
}

interface Props {
  alarms: AlarmDefinition[];
  enabled?: boolean;
}

export function AlarmRuntime({ alarms, enabled = true }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [showSnoozeChoices, setShowSnoozeChoices] = useState(false);
  const [muted, setMuted] = useState(false);
  const handledRef = useRef(new Set<string>());
  const snoozesRef = useRef<Record<string, number>>({});
  const current = queue[0] ?? null;

  const enqueue = useCallback((items: QueueItem[]) => {
    if (items.length === 0) return;
    setQueue((prev) => {
      const keys = new Set(prev.map((p) => p.occurrenceKey));
      const next = [...prev];
      for (const item of items) {
        if (keys.has(item.occurrenceKey)) continue;
        keys.add(item.occurrenceKey);
        next.push(item);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      const now = new Date();
      const nowMs = now.getTime();

      // Drop snoozes for deleted/disabled alarms
      for (const alarmId of Object.keys(snoozesRef.current)) {
        const def = alarms.find((a) => a.id === alarmId);
        if (!def || !def.enabled) delete snoozesRef.current[alarmId];
      }

      // Snooze due
      const snoozeDue: QueueItem[] = [];
      for (const [alarmId, fireAt] of Object.entries(snoozesRef.current)) {
        if (fireAt > nowMs) continue;
        const def = alarms.find((a) => a.id === alarmId);
        delete snoozesRef.current[alarmId];
        if (!def || !def.enabled) continue;
        const key = `${alarmId}|snooze|${fireAt}`;
        if (handledRef.current.has(key)) continue;
        handledRef.current.add(key);
        snoozeDue.push({ alarm: def, occurrenceKey: key });
      }

      const scheduled = findDueAlarms(alarms, now, handledRef.current, GRACE_MS);
      for (const item of scheduled) {
        handledRef.current.add(item.occurrenceKey);
      }
      enqueue([...snoozeDue, ...scheduled]);

      // If active alarm was removed/disabled, drop it
      setQueue((prev) =>
        prev.filter((q) => {
          const def = alarms.find((a) => a.id === q.alarm.id);
          return Boolean(def?.enabled);
        })
      );
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [alarms, enabled, enqueue]);

  useEffect(() => {
    if (!current || muted) {
      stopAlarmTone();
      return;
    }
    void startAlarmTone(current.alarm.toneId);
    return () => stopAlarmTone();
  }, [current, muted, current?.alarm.toneId]);

  useEffect(() => {
    setShowSnoozeChoices(false);
    setMuted(false);
  }, [current?.occurrenceKey]);

  const dismiss = () => {
    stopAlarmTone();
    setQueue((prev) => prev.slice(1));
  };

  const snooze = (minutes: SnoozeMinutes) => {
    if (!current) return;
    snoozesRef.current[current.alarm.id] = snoozeFireAt(Date.now(), minutes);
    dismiss();
  };

  if (!enabled || !current) return null;

  return (
    <AlarmDialog
      label={current.alarm.label}
      time={current.alarm.time}
      muted={muted}
      showSnoozeChoices={showSnoozeChoices}
      onToggleMute={() => setMuted((m) => !m)}
      onDismiss={dismiss}
      onOpenSnooze={() => setShowSnoozeChoices(true)}
      onSnooze={snooze}
    />
  );
}
