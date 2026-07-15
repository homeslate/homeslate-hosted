# Recurring Alarms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Homeslate physical display show a dismissible, snoozable fullscreen alarm dialog with looping built-in sound on daily/weekday schedules, managed from Display Detail settings and an Alarms widget.

**Architecture:** Alarm definitions live on display config (`alarms[]`). Pure schedule helpers decide when to fire. `AlarmRuntime` mounts only in live `DisplayViewer` (not preview), queues rings, and hosts `AlarmDialog`. Shared `AlarmListEditor` is used in Settings and the widget. Persist via existing authenticated `/api/config` upsert + config poll; snooze/handled state is session-only. Tones use Web Audio oscillators (no binary assets).

**Tech Stack:** React 19, TypeScript, Mantine, Zustand dashboard store, Vitest, existing Netlify config PUT (zod `.passthrough()` already allows new keys).

## Global Constraints

- Interrupt **live DisplayViewer only** (`isPreview === false`); never ring in management preview.
- Recurrence v1: **daily + weekday selection** (`days: 0=Sun…6=Sat`; empty or all 7 = every day).
- Storage: **display config JSON** `alarms`; no new DB table.
- Snooze chooser: **5 / 10 / 15** minutes; session-only.
- Tones: **`chime` | `bell` | `radar`** via Web Audio.
- Dialog shows **label + time**.
- Authenticated surfaces persist `alarms` via `/api/config`. Kiosk widget is a **read-only** list in v1 (no unauthenticated config write path exists); dismiss/snooze is the kiosk interaction.
- Grace window: fire if tick is within **60s** after target minute; no backlog if the tab was closed through the window.
- Device **local timezone** only.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/alarms/types.ts` | `AlarmToneId`, `AlarmDefinition`, tone option list |
| `src/alarms/schedule.ts` | Pure matching, occurrence keys, grace, snooze helpers |
| `src/alarms/schedule.test.ts` | Unit tests for schedule helpers |
| `src/alarms/tones.ts` | Start/stop looping Web Audio patterns by `toneId` |
| `src/alarms/AlarmDialog.tsx` + `.module.css` | Fullscreen dismiss / snooze / mute UI |
| `src/alarms/AlarmRuntime.tsx` | Tick loop, queue, snooze map, dialog host |
| `src/alarms/AlarmListEditor.tsx` + `.module.css` | Shared CRUD list + edit form |
| `src/alarms/AlarmsContext.tsx` | Provide `alarms` + optional `onAlarmsChange` to widget |
| `src/widgets/AlarmsWidget.tsx` + `.module.css` | Widget surface using context / editor |
| Modify: `src/widgets/registry.ts` | Register `alarms` widget |
| Modify: `src/types/api.ts` | `alarms` on `ConfigUpsertRequest` |
| Modify: `netlify/functions/config.ts` | Optional `alarms` in zod schema (explicit) |
| Modify: `src/store/dashboardStore.ts` | `alarms` on Display + `setAlarms` |
| Modify: `src/pages/DisplayDetailPage.tsx` | Settings section + save payload |
| Modify: `src/pages/ViewEditorPage.tsx` | Include `alarms` in autosave payload/deps |
| Modify: `src/components/DisplayViewer.tsx` | Parse `alarms`, mount runtime, provide context |

---

### Task 1: Types And Schedule Helpers

**Files:**
- Create: `src/alarms/types.ts`
- Create: `src/alarms/schedule.ts`
- Test: `src/alarms/schedule.test.ts`

**Interfaces:**
- Produces: `AlarmToneId`, `AlarmDefinition`, `ALARM_TONE_OPTIONS`, `occurrenceKey`, `isValidTime`, `normalizeDays`, `isAlarmScheduledOnDay`, `isWithinGraceWindow`, `findDueAlarms`, `snoozeFireAt`

- [ ] **Step 1: Write the failing tests**

Create `src/alarms/schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  findDueAlarms,
  isAlarmScheduledOnDay,
  isValidTime,
  isWithinGraceWindow,
  normalizeDays,
  occurrenceKey,
  snoozeFireAt,
} from './schedule';
import type { AlarmDefinition } from './types';

const base = (overrides: Partial<AlarmDefinition> = {}): AlarmDefinition => ({
  id: 'a1',
  label: 'Dinner',
  enabled: true,
  time: '19:00',
  days: [0, 1, 2, 3, 4, 5, 6],
  toneId: 'chime',
  ...overrides,
});

describe('isValidTime', () => {
  it('accepts HH:mm', () => {
    expect(isValidTime('07:30')).toBe(true);
    expect(isValidTime('19:00')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isValidTime('9:00')).toBe(false);
    expect(isValidTime('25:00')).toBe(false);
    expect(isValidTime('')).toBe(false);
  });
});

describe('normalizeDays / isAlarmScheduledOnDay', () => {
  it('treats empty days as every day', () => {
    expect(normalizeDays([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(isAlarmScheduledOnDay(base({ days: [] }), 3)).toBe(true);
  });
  it('respects weekday subset', () => {
    expect(isAlarmScheduledOnDay(base({ days: [1, 2, 3, 4, 5] }), 0)).toBe(false);
    expect(isAlarmScheduledOnDay(base({ days: [1, 2, 3, 4, 5] }), 1)).toBe(true);
  });
});

describe('occurrenceKey', () => {
  it('includes id date and time', () => {
    const d = new Date(2026, 6, 14, 19, 0, 0); // Jul 14 2026 local
    expect(occurrenceKey('a1', d, '19:00')).toBe('a1|2026-07-14|19:00');
  });
});

describe('isWithinGraceWindow', () => {
  it('accepts within 60s after target minute', () => {
    const now = new Date(2026, 6, 14, 19, 0, 45);
    expect(isWithinGraceWindow(now, '19:00', 60_000)).toBe(true);
  });
  it('rejects before target and after grace', () => {
    expect(isWithinGraceWindow(new Date(2026, 6, 14, 18, 59, 59), '19:00', 60_000)).toBe(false);
    expect(isWithinGraceWindow(new Date(2026, 6, 14, 19, 1, 1), '19:00', 60_000)).toBe(false);
  });
});

describe('findDueAlarms', () => {
  it('returns due enabled alarms not already handled', () => {
    const now = new Date(2026, 6, 14, 19, 0, 10); // Tuesday
    const alarms = [
      base({ id: 'a1', time: '19:00' }),
      base({ id: 'a2', time: '19:00', enabled: false }),
      base({ id: 'a3', time: '07:00' }),
    ];
    const handled = new Set<string>();
    const due = findDueAlarms(alarms, now, handled, 60_000);
    expect(due.map((d) => d.alarm.id)).toEqual(['a1']);
    expect(due[0].occurrenceKey).toBe('a1|2026-07-14|19:00');
  });
  it('skips handled occurrence keys', () => {
    const now = new Date(2026, 6, 14, 19, 0, 10);
    const handled = new Set(['a1|2026-07-14|19:00']);
    expect(findDueAlarms([base()], now, handled, 60_000)).toEqual([]);
  });
  it('skips invalid time entries', () => {
    const now = new Date(2026, 6, 14, 19, 0, 10);
    expect(findDueAlarms([base({ time: 'nope' })], now, new Set(), 60_000)).toEqual([]);
  });
});

describe('snoozeFireAt', () => {
  it('adds minutes to now', () => {
    const now = new Date(2026, 6, 14, 19, 0, 0).getTime();
    expect(snoozeFireAt(now, 10)).toBe(now + 10 * 60_000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/alarms/schedule.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement types and schedule helpers**

Create `src/alarms/types.ts`:

```ts
export type AlarmToneId = 'chime' | 'bell' | 'radar';

export interface AlarmDefinition {
  id: string;
  label: string;
  enabled: boolean;
  time: string; // HH:mm
  days: number[]; // 0=Sun..6=Sat
  toneId: AlarmToneId;
}

export const ALARM_TONE_OPTIONS: { value: AlarmToneId; label: string }[] = [
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'radar', label: 'Radar' },
];

export const SNOOZE_MINUTES = [5, 10, 15] as const;
export type SnoozeMinutes = (typeof SNOOZE_MINUTES)[number];
```

Create `src/alarms/schedule.ts`:

```ts
import type { AlarmDefinition } from './types';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

export function normalizeDays(days: unknown): number[] {
  if (!Array.isArray(days) || days.length === 0) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  const cleaned = days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6);
  if (cleaned.length === 0) return [0, 1, 2, 3, 4, 5, 6];
  return [...new Set(cleaned)].sort((a, b) => a - b);
}

export function isAlarmScheduledOnDay(alarm: AlarmDefinition, day: number): boolean {
  return normalizeDays(alarm.days).includes(day);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function occurrenceKey(alarmId: string, date: Date, time: string): string {
  return `${alarmId}|${formatLocalDateKey(date)}|${time}`;
}

/** True if now is in [targetMinuteStart, targetMinuteStart + graceMs). */
export function isWithinGraceWindow(now: Date, time: string, graceMs: number): boolean {
  if (!isValidTime(time)) return false;
  const [hh, mm] = time.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  const delta = now.getTime() - target.getTime();
  return delta >= 0 && delta < graceMs;
}

export function findDueAlarms(
  alarms: AlarmDefinition[],
  now: Date,
  handledOccurrenceKeys: Set<string>,
  graceMs: number
): Array<{ alarm: AlarmDefinition; occurrenceKey: string }> {
  const day = now.getDay();
  const due: Array<{ alarm: AlarmDefinition; occurrenceKey: string }> = [];
  for (const alarm of alarms) {
    if (!alarm || typeof alarm.id !== 'string') continue;
    if (!alarm.enabled) continue;
    if (!isValidTime(alarm.time)) continue;
    if (!isAlarmScheduledOnDay(alarm, day)) continue;
    if (!isWithinGraceWindow(now, alarm.time, graceMs)) continue;
    const key = occurrenceKey(alarm.id, now, alarm.time);
    if (handledOccurrenceKeys.has(key)) continue;
    due.push({ alarm, occurrenceKey: key });
  }
  return due;
}

export function snoozeFireAt(nowMs: number, minutes: number): number {
  return nowMs + minutes * 60_000;
}

export function coerceAlarm(raw: unknown): AlarmDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.label !== 'string') return null;
  if (typeof o.enabled !== 'boolean' || typeof o.time !== 'string') return null;
  if (!isValidTime(o.time)) return null;
  const toneId =
    o.toneId === 'chime' || o.toneId === 'bell' || o.toneId === 'radar' ? o.toneId : 'chime';
  return {
    id: o.id,
    label: o.label,
    enabled: o.enabled,
    time: o.time,
    days: normalizeDays(o.days),
    toneId,
  };
}

export function coerceAlarms(raw: unknown): AlarmDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceAlarm).filter((a): a is AlarmDefinition => a !== null);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/alarms/schedule.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/alarms/types.ts src/alarms/schedule.ts src/alarms/schedule.test.ts
git commit -m "Add alarm schedule helpers and types."
```

---

### Task 2: Tone Player

**Files:**
- Create: `src/alarms/tones.ts`

**Interfaces:**
- Consumes: `AlarmToneId` from `./types`
- Produces: `startAlarmTone(toneId)`, `stopAlarmTone()`

- [ ] **Step 1: Implement Web Audio tone loops**

Create `src/alarms/tones.ts`:

```ts
import type { AlarmToneId } from './types';

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(frequency: number, durationMs: number, gainValue = 0.15): void {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.value = gainValue;
  osc.connect(gain);
  gain.connect(ac.destination);
  const now = ac.currentTime;
  osc.start(now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.stop(now + durationMs / 1000);
}

function playPattern(toneId: AlarmToneId): void {
  if (toneId === 'chime') {
    beep(880, 180);
    setTimeout(() => beep(1174, 220), 200);
  } else if (toneId === 'bell') {
    beep(660, 400, 0.2);
  } else {
    beep(440, 120);
    setTimeout(() => beep(550, 120), 140);
    setTimeout(() => beep(660, 180), 280);
  }
}

export async function startAlarmTone(toneId: AlarmToneId): Promise<void> {
  stopAlarmTone();
  const ac = getCtx();
  if (ac.state === 'suspended') {
    try {
      await ac.resume();
    } catch {
      return;
    }
  }
  playPattern(toneId);
  timer = setInterval(() => playPattern(toneId), 1200);
}

export function stopAlarmTone(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/alarms/tones.ts
git commit -m "Add Web Audio alarm tone player."
```

---

### Task 3: Alarm Dialog And Runtime

**Files:**
- Create: `src/alarms/AlarmDialog.tsx`
- Create: `src/alarms/AlarmDialog.module.css`
- Create: `src/alarms/AlarmRuntime.tsx`

**Interfaces:**
- Consumes: `AlarmDefinition`, `SNOOZE_MINUTES`, `findDueAlarms`, `snoozeFireAt`, `startAlarmTone`, `stopAlarmTone`
- Produces: `AlarmRuntime({ alarms, enabled })` React component

- [ ] **Step 1: Implement AlarmDialog**

`src/alarms/AlarmDialog.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, canvas 20%, black);
  padding: 1.5rem;
}

.card {
  width: min(560px, 100%);
  border-radius: 1rem;
  background: var(--mantine-color-body, #1a1b1e);
  color: var(--mantine-color-text, #fff);
  padding: 2rem;
  text-align: center;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
}

.label {
  font-size: clamp(1.75rem, 5vw, 2.75rem);
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 0.5rem;
}

.time {
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  opacity: 0.75;
  margin-bottom: 1.75rem;
}

.pulse {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.25rem;
  border-radius: 50%;
  background: var(--mantine-color-red-6, #fa5252);
  animation: pulse 1.2s ease-in-out infinite;
}

.pulseSilent {
  opacity: 0.45;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.75; }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.snoozeRow {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.topRow {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}
```

`src/alarms/AlarmDialog.tsx`:

```tsx
import { Button, ActionIcon } from '@mantine/core';
import { IconVolume, IconVolumeOff } from '@tabler/icons-react';
import { SNOOZE_MINUTES, type SnoozeMinutes } from './types';
import classes from './AlarmDialog.module.css';

interface Props {
  label: string;
  time: string;
  muted: boolean;
  showSnoozeChoices: boolean;
  onToggleMute: () => void;
  onDismiss: () => void;
  onOpenSnooze: () => void;
  onSnooze: (minutes: SnoozeMinutes) => void;
}

export function AlarmDialog({
  label,
  time,
  muted,
  showSnoozeChoices,
  onToggleMute,
  onDismiss,
  onOpenSnooze,
  onSnooze,
}: Props) {
  return (
    <div className={classes.overlay} role="alertdialog" aria-modal="true" aria-label={label}>
      <div className={classes.card}>
        <div className={classes.topRow}>
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute alarm' : 'Mute alarm'}
          >
            {muted ? <IconVolumeOff size={22} /> : <IconVolume size={22} />}
          </ActionIcon>
        </div>
        <div className={`${classes.pulse} ${muted ? classes.pulseSilent : ''}`} />
        <div className={classes.label}>{label || 'Alarm'}</div>
        <div className={classes.time}>{time}</div>
        <div className={classes.actions}>
          <Button size="xl" onClick={onDismiss}>
            Dismiss
          </Button>
          {!showSnoozeChoices ? (
            <Button size="xl" variant="light" onClick={onOpenSnooze}>
              Snooze
            </Button>
          ) : (
            <div className={classes.snoozeRow}>
              {SNOOZE_MINUTES.map((m) => (
                <Button key={m} size="lg" variant="light" onClick={() => onSnooze(m)}>
                  {m} min
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement AlarmRuntime**

`src/alarms/AlarmRuntime.tsx`:

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add src/alarms/AlarmDialog.tsx src/alarms/AlarmDialog.module.css src/alarms/AlarmRuntime.tsx
git commit -m "Add alarm dialog and display runtime."
```

---

### Task 4: Shared Alarm List Editor

**Files:**
- Create: `src/alarms/AlarmListEditor.tsx`
- Create: `src/alarms/AlarmListEditor.module.css`

**Interfaces:**
- Consumes: `AlarmDefinition`, `ALARM_TONE_OPTIONS`
- Produces: `AlarmListEditor({ alarms, onChange, readOnly? })`

- [ ] **Step 1: Implement AlarmListEditor**

Use Mantine `Stack`, `Group`, `Switch`, `TextInput`, `TimeInput` (or `TextInput` type/masked `HH:mm` if TimeInput unavailable), day toggles for Sun–Sat, tone `Select`, Add/Delete. Call `onChange(nextAlarms)` on every edit. New alarms:

```ts
{
  id: uuidv4(),
  label: 'Alarm',
  enabled: true,
  time: '07:00',
  days: [0, 1, 2, 3, 4, 5, 6],
  toneId: 'chime',
}
```

Day labels: `['S','M','T','W','T','F','S']` mapped to indices 0–6. When `readOnly`, hide add/delete/edit controls; only show list (label, time, days summary, enabled state as text or disabled switch).

Days summary helper inline: if 7 days → `Every day`; else join short names of selected days.

Keep styles compact kiosk-friendly tap targets in the module CSS for day chips.

- [ ] **Step 2: Commit**

```bash
git add src/alarms/AlarmListEditor.tsx src/alarms/AlarmListEditor.module.css
git commit -m "Add shared alarm list editor."
```

---

### Task 5: Config Plumbing (Store + API Types)

**Files:**
- Modify: `src/types/api.ts` — add `alarms?: AlarmDefinition[]` to `ConfigUpsertRequest`
- Modify: `netlify/functions/config.ts` — add optional zod array for alarms (id/label/enabled/time/days/toneId)
- Modify: `src/store/dashboardStore.ts` — add `alarms?: AlarmDefinition[]` on `Display` and `RemoteDisplay.config`; merge in `setDisplays`; add `setAlarms(displayId, alarms)`; default `alarms: []` in `addDisplay`

**Interfaces:**
- Consumes: `AlarmDefinition` from `src/alarms/types.ts`
- Produces: `setAlarms(displayId: string, alarms: AlarmDefinition[]) => void`

- [ ] **Step 1: Extend API type**

In `src/types/api.ts`:

```ts
import type { AlarmDefinition } from '../alarms/types';
// ...
export interface ConfigUpsertRequest {
  // existing fields...
  alarms?: AlarmDefinition[];
}
```

- [ ] **Step 2: Extend config zod schema**

In `netlify/functions/config.ts` inside `ConfigBodySchema`:

```ts
alarms: z
  .array(
    z.object({
      id: z.string(),
      label: z.string(),
      enabled: z.boolean(),
      time: z.string(),
      days: z.array(z.number().int().min(0).max(6)),
      toneId: z.enum(['chime', 'bell', 'radar']),
    })
  )
  .optional(),
```

- [ ] **Step 3: Extend dashboard store**

- Import `AlarmDefinition` and `coerceAlarms`.
- Add `alarms?: AlarmDefinition[]` to `Display` and remote config type.
- In `setDisplays` merge: `alarms: coerceAlarms(config.alarms ?? existing?.alarms ?? [])`.
- In `addDisplay`, set `alarms: []`.
- Add action:

```ts
setAlarms: (displayId, alarms) => {
  set((state) => ({
    displays: updateDisplay(state.displays, displayId, (d) => ({ ...d, alarms })),
  }));
},
```

Wire `setAlarms` into the store interface and persisted state (alarms ride along with displays persist already).

- [ ] **Step 4: Commit**

```bash
git add src/types/api.ts netlify/functions/config.ts src/store/dashboardStore.ts
git commit -m "Persist alarms on display config."
```

---

### Task 6: Display Detail Settings + View Editor Autosave

**Files:**
- Modify: `src/pages/DisplayDetailPage.tsx`
- Modify: `src/pages/ViewEditorPage.tsx`

**Interfaces:**
- Consumes: `AlarmListEditor`, `setAlarms`, `display.alarms`

- [ ] **Step 1: Include alarms in DisplayDetailPage `saveConfig`**

Destructure `alarms` with other display fields; put `alarms` on the `ConfigUpsertRequest` payload.

- [ ] **Step 2: Add Alarms settings section**

After Sticky Notes (or Holiday Effects), add:

```tsx
<section className={classes.section}>
  <Title order={5} className={classes.sectionTitle} mb="md">Alarms</Title>
  <Paper className={classes.settingsCard} p="md" radius="md">
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        Recurring alarms ring on this display with sound. Snooze for 5, 10, or 15 minutes.
      </Text>
      <AlarmListEditor
        alarms={display.alarms ?? []}
        onChange={(next) => {
          setAlarms(display.id, next);
          saveConfig({ alarms: next });
        }}
      />
    </Stack>
  </Paper>
</section>
```

Import `AlarmListEditor` and `setAlarms` from the dashboard store.

- [ ] **Step 3: View editor autosave**

In `ViewEditorPage.tsx` subscription: treat `d.alarms !== prev.alarms` as a change; include `alarms: d.alarms` in the PUT payload.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DisplayDetailPage.tsx src/pages/ViewEditorPage.tsx
git commit -m "Add alarms management in display settings."
```

---

### Task 7: Alarms Context, Widget, Registry

**Files:**
- Create: `src/alarms/AlarmsContext.tsx`
- Create: `src/widgets/AlarmsWidget.tsx`
- Create: `src/widgets/AlarmsWidget.module.css`
- Modify: `src/widgets/registry.ts`
- Modify: `src/store/dashboardStore.ts` / editor dashboard path so view editor provides context (via wrapping Dashboard or DisplayDetail preview)

**Interfaces:**
- Produces: `AlarmsProvider`, `useAlarms()`, widget type `'alarms'`

- [ ] **Step 1: AlarmsContext**

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { AlarmDefinition } from './types';

interface AlarmsContextValue {
  alarms: AlarmDefinition[];
  onAlarmsChange?: (alarms: AlarmDefinition[]) => void;
  readOnly: boolean;
}

const AlarmsContext = createContext<AlarmsContextValue>({
  alarms: [],
  readOnly: true,
});

export function AlarmsProvider({
  alarms,
  onAlarmsChange,
  readOnly = false,
  children,
}: {
  alarms: AlarmDefinition[];
  onAlarmsChange?: (alarms: AlarmDefinition[]) => void;
  readOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <AlarmsContext.Provider
      value={{ alarms, onAlarmsChange, readOnly: readOnly || !onAlarmsChange }}
    >
      {children}
    </AlarmsContext.Provider>
  );
}

export function useAlarms(): AlarmsContextValue {
  return useContext(AlarmsContext);
}
```

- [ ] **Step 2: AlarmsWidget**

Widget config can be minimal:

```ts
export interface AlarmsConfig extends WidgetConfig {
  transparentBackground: boolean;
}
```

Component: `const { alarms, onAlarmsChange, readOnly } = useAlarms();` render `AlarmListEditor` with those props. Settings component: toggle `transparentBackground` only (list editing is the widget body / settings can embed the same editor when `onAlarmsChange` exists).

Empty context (no provider): show short empty message “Add alarms in Display Settings”.

- [ ] **Step 3: Register widget**

In `registry.ts` use `IconAlarm`, type `'alarms'`, name `'Alarms'`, description `'View and manage recurring display alarms'`, default layout ~`w:3,h:3,minW:2,minH:2`, `defaultConfig: { transparentBackground: false }`.

- [ ] **Step 4: Provide context in authenticated editor**

In `Dashboard.tsx` or `ViewEditorPage.tsx` / wherever the editable dashboard mounts: wrap with `AlarmsProvider` using `display.alarms` and `onAlarmsChange` that calls `setAlarms` (autosave already picks up `alarms` from Task 6).

If Dashboard is shared, pass props:

```tsx
alarms={display.alarms ?? []}
onAlarmsChange={(next) => setAlarms(display.id, next)}
```

- [ ] **Step 5: Commit**

```bash
git add src/alarms/AlarmsContext.tsx src/widgets/AlarmsWidget.tsx src/widgets/AlarmsWidget.module.css src/widgets/registry.ts src/components/Dashboard.tsx src/pages/ViewEditorPage.tsx
git commit -m "Add Alarms widget and editor context."
```

---

### Task 8: Wire Runtime Into DisplayViewer

**Files:**
- Modify: `src/components/DisplayViewer.tsx`

**Interfaces:**
- Consumes: `coerceAlarms`, `AlarmRuntime`, `AlarmsProvider`

- [ ] **Step 1: Extend local DisplayConfig**

```ts
import type { AlarmDefinition } from '../alarms/types';
import { coerceAlarms } from '../alarms/schedule';
import { AlarmRuntime } from '../alarms/AlarmRuntime';
import { AlarmsProvider } from '../alarms/AlarmsContext';

interface DisplayConfig {
  // existing fields...
  alarms?: AlarmDefinition[];
}
```

When applying fetched config, normalize: keep using `coerceAlarms(data.config.alarms)`.

- [ ] **Step 2: Mount provider + runtime**

Inside the live viewer return (still under `DisplayProvider`), wrap dashboard children with:

```tsx
<AlarmsProvider alarms={coerceAlarms(config?.alarms)} readOnly>
  ...
  {!isPreview && <AlarmRuntime alarms={coerceAlarms(config?.alarms)} enabled={!passcodeRequired} />}
</AlarmsProvider>
```

Do **not** mount `AlarmRuntime` when `isPreview` is true. Do not ring while passcode gate is showing (`passcodeRequired`).

- [ ] **Step 3: Manual sanity check**

Run: `npm run dev`

- Open a display in management → Settings → add alarm for 1–2 minutes ahead, every day, tone Chime → save.
- Open the **paired live display URL** (not preview): at the time, dialog + sound; test mute, snooze 5, dismiss.
- Confirm management preview does not ring.
- Add Alarms widget to a view; confirm list shows the alarm.

- [ ] **Step 4: Commit**

```bash
git add src/components/DisplayViewer.tsx
git commit -m "Ring recurring alarms on the live display viewer."
```

---

### Task 9: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run unit tests**

Run: `npm run test:run -- src/alarms/schedule.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full unit suite**

Run: `npm run test:run`

Expected: PASS (no regressions).

- [ ] **Step 3: Typecheck if available**

Run: `npx tsc --noEmit`

Expected: no errors from alarm changes.

---

## Spec Coverage Check

| Spec item | Task |
|-----------|------|
| Config `alarms[]` model | 1, 5 |
| Display runtime scheduler | 3, 8 |
| Dialog dismiss / snooze 5–10–15 / mute | 3 |
| Built-in tones | 2 |
| Shared editor in Settings + widget | 4, 6, 7 |
| Preview does not ring | 8 |
| Grace window / no backlog | 1, 3 |
| Queue same-minute alarms | 3 |
| Session snooze / handled keys | 3 |
| Invalid tone/time coercion | 1 |
| Unit tests for matching / snooze / grace | 1 |
| No new DB table | 5 (config JSON only) |

## Placeholder Scan

None intentional — tones are Web Audio (no binary TBD), kiosk CRUD explicitly out of v1 (read-only widget on display).
