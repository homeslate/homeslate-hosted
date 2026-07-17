# Timers Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Timers widget for saved countdown presets and concurrent session timers that alert via the shared alarm dialog, tones, and voice pipeline (plus Restart).

**Architecture:** Presets persist in `widget.config.presets`. Session runtimes live in `TimersContext` (survive view rotation; lost on reload). Evolve `AlarmRuntime` into a shared `AlertRuntime` that queues both alarm and timer alerts. Timers feed the queue on complete; Restart starts a new session runtime.

**Tech Stack:** React 19, TypeScript, Mantine, Vitest, existing widget registry + config upsert (no new API).

## Global Constraints

- Interrupt **live DisplayViewer only** (`isPreview === false`); never ring in management preview / editor.
- Running timers are **session-only**; presets persist in widget config.
- Multiple concurrent timers; alerts share one FIFO queue with alarms.
- While running: **pause / resume + cancel**.
- On complete: **dismiss, snooze 5/10/15, restart, mute**; voice dismiss/snooze when `voiceEnabled`.
- Tones: reuse **`chime` | `bell` | `radar`** from `src/alarms/types.ts`.
- No Display Detail settings block, no PATCH API, no stopwatch, no voice Restart (v1).

## File Structure

| File | Responsibility |
|------|----------------|
| `src/timers/types.ts` | `TimerPreset`, `TimerRuntime`, `TimersWidgetConfig` |
| `src/timers/format.ts` | Duration formatting + remaining/pause/resume/complete pure helpers |
| `src/timers/format.test.ts` | Unit tests for helpers |
| `src/timers/TimersContext.tsx` | Session runtimes + enqueue registration + restart |
| `src/alarms/alertTypes.ts` | Shared `AlertQueueItem` / `AlertKind` |
| `src/alarms/AlarmDialog.tsx` | Optional Restart button for timer alerts |
| `src/alarms/AlarmRuntime.tsx` → evolve / export as `AlertRuntime` | Shared queue; accept timer enqueue + restart callback |
| `src/widgets/TimersWidget.tsx` + `.module.css` | Preset CRUD + active timers UI |
| Modify: `src/widgets/registry.ts` | Register `timers` |
| Modify: `src/components/DisplayViewer.tsx` | `TimersProvider` + wire AlertRuntime |
| Modify: `src/pages/ViewEditorPage.tsx` | `TimersProvider` around Dashboard |

---

### Task 1: Timer Types And Pure Helpers

**Files:**
- Create: `src/timers/types.ts`
- Create: `src/timers/format.ts`
- Test: `src/timers/format.test.ts`

**Interfaces:**
- Produces: `TimerPreset`, `TimerRuntime`, `TimersWidgetConfig`, `formatDurationMs`, `remainingMs`, `pauseRuntime`, `resumeRuntime`, `isRuntimeComplete`, `createRuntimeFromPreset`, `createRuntimeFromFields`

- [ ] **Step 1: Write the failing tests**

Create `src/timers/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createRuntimeFromFields,
  formatDurationMs,
  isRuntimeComplete,
  pauseRuntime,
  remainingMs,
  resumeRuntime,
} from './format';
import type { TimerRuntime } from './types';

describe('formatDurationMs', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatDurationMs(0)).toBe('0:00');
    expect(formatDurationMs(5_000)).toBe('0:05');
    expect(formatDurationMs(65_000)).toBe('1:05');
    expect(formatDurationMs(8 * 60_000)).toBe('8:00');
  });
  it('formats an hour or more as h:mm:ss', () => {
    expect(formatDurationMs(3_661_000)).toBe('1:01:01');
  });
  it('floors partial seconds and clamps negative to 0', () => {
    expect(formatDurationMs(1_999)).toBe('0:01');
    expect(formatDurationMs(-100)).toBe('0:00');
  });
});

describe('remaining / pause / resume / complete', () => {
  const running = (overrides: Partial<TimerRuntime> = {}): TimerRuntime => ({
    id: 'r1',
    label: 'Pasta',
    durationSeconds: 60,
    toneId: 'chime',
    endsAt: 1_000_000 + 30_000,
    remainingMs: 30_000,
    status: 'running',
    ...overrides,
  });

  it('remainingMs uses endsAt while running', () => {
    expect(remainingMs(running(), 1_000_000 + 10_000)).toBe(20_000);
  });

  it('remainingMs uses remainingMs while paused', () => {
    expect(remainingMs(running({ status: 'paused', remainingMs: 12_000 }), 1_000_000)).toBe(12_000);
  });

  it('pause freezes remaining and sets paused', () => {
    const next = pauseRuntime(running(), 1_000_000 + 10_000);
    expect(next.status).toBe('paused');
    expect(next.remainingMs).toBe(20_000);
  });

  it('resume sets endsAt from remaining', () => {
    const paused = pauseRuntime(running(), 1_000_000 + 10_000);
    const next = resumeRuntime(paused, 2_000_000);
    expect(next.status).toBe('running');
    expect(next.endsAt).toBe(2_000_000 + 20_000);
  });

  it('isRuntimeComplete when remaining <= 0', () => {
    expect(isRuntimeComplete(running({ endsAt: 1_000_000 }), 1_000_000)).toBe(true);
    expect(isRuntimeComplete(running({ endsAt: 1_000_001 }), 1_000_000)).toBe(false);
  });

  it('createRuntimeFromFields rejects non-positive duration', () => {
    expect(
      createRuntimeFromFields({
        id: 'x',
        label: 'Bad',
        durationSeconds: 0,
        toneId: 'chime',
        nowMs: 1_000,
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/timers/format.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement types and helpers**

Create `src/timers/types.ts`:

```ts
import type { AlarmToneId } from '../alarms/types';

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
```

Create `src/timers/format.ts` implementing the tested API:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/timers/format.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/timers/types.ts src/timers/format.ts src/timers/format.test.ts
git commit -m "Add timer duration helpers and types."
```

---

### Task 2: Shared Alert Types + Dialog Restart

**Files:**
- Create: `src/alarms/alertTypes.ts`
- Modify: `src/alarms/AlarmDialog.tsx`
- Modify: `src/alarms/AlarmDialog.module.css` (only if Restart needs spacing — reuse `.actions`)

**Interfaces:**
- Produces: `AlertKind`, `AlertQueueItem`, `AlarmDialog` props `showRestart?: boolean`, `onRestart?: () => void`
- Consumes: existing dialog layout / snooze UI

- [ ] **Step 1: Add alert types**

Create `src/alarms/alertTypes.ts`:

```ts
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
```

- [ ] **Step 2: Extend AlarmDialog**

Update `AlarmDialog` props:

```ts
interface Props {
  label: string;
  time: string;
  muted: boolean;
  showSnoozeChoices: boolean;
  showRestart?: boolean;
  voiceListening?: boolean;
  voiceUnavailableReason?: VoiceStatusReason | null;
  onToggleMute: () => void;
  onDismiss: () => void;
  onOpenSnooze: () => void;
  onSnooze: (minutes: SnoozeMinutes) => void;
  onRestart?: () => void;
}
```

In the actions block, when `showRestart && onRestart` and not showing snooze choices, render a third button:

```tsx
{showRestart && onRestart && !showSnoozeChoices ? (
  <Button size="xl" variant="default" onClick={onRestart}>
    Restart
  </Button>
) : null}
```

Keep Dismiss + Snooze behavior unchanged for alarms (`showRestart` omitted/false).

- [ ] **Step 3: Smoke-check TypeScript for dialog consumers**

Run: `npx tsc -b --pretty false 2>&1 | head -40`
Expected: no new errors from `AlarmDialog` (AlarmRuntime still compiles without `showRestart`).

- [ ] **Step 4: Commit**

```bash
git add src/alarms/alertTypes.ts src/alarms/AlarmDialog.tsx src/alarms/AlarmDialog.module.css
git commit -m "Add shared alert types and Restart on alarm dialog."
```

---

### Task 3: Evolve AlarmRuntime Into Shared AlertRuntime

**Files:**
- Modify: `src/alarms/AlarmRuntime.tsx` (keep filename; export `AlertRuntime` as alias or rename component to `AlertRuntime` and `export { AlertRuntime as AlarmRuntime }` for compatibility)
- Test: `src/alarms/alertRuntime.test.ts` (pure helpers extracted if needed — prefer testing enqueue/snooze mapping via small exported helpers)

**Interfaces:**
- Consumes: `AlertQueueItem`, `snoozeFireAt`, tones, voice, `AlarmDialog`
- Produces: `AlertRuntime` props:
  - `alarms: AlarmDefinition[]`
  - `enabled?: boolean`
  - `voiceEnabled?: boolean`
  - `onRegisterEnqueue?: (enqueue: (item: AlertQueueItem) => void) => void`
  - `onTimerRestart?: (timer: NonNullable<AlertQueueItem['timer']>) => void`

**Behavior to implement:**

1. Internal queue is `AlertQueueItem[]` (not `{ alarm, occurrenceKey }`).
2. Existing alarm schedule tick builds `AlertQueueItem` with `kind: 'alarm'`, `id: occurrenceKey`, `subtitle: alarm.time`, `alarmId: alarm.id`.
3. Alarm snooze map remains `alarmId → fireAt`; timer snooze map is separate `runId → { fireAt, timer meta }`.
4. On mount, call `onRegisterEnqueue?.(enqueueOne)` where `enqueueOne` dedupes by `item.id`.
5. On unmount / `enabled=false`, call `onRegisterEnqueue?.(() => {})` or pass no-op so TimersContext does not enqueue into a dead runtime.
6. `dismiss` pops queue; clears timer snooze for that run if dismissing a timer (optional — dismiss means done).
7. `snooze(minutes)`:
   - alarm: same as today (`snoozesRef[alarmId] = snoozeFireAt(...)`)
   - timer: store `{ fireAt, timer }` under `timerSnoozesRef[runId]`; on due, enqueue new item with new id `${runId}|snooze|${fireAt}` and same `timer` meta
8. `restart`: if current is timer and `onTimerRestart` + `timer` meta exist, call `onTimerRestart(timer)` then `dismiss()`.
9. Dialog: `showRestart={current.kind === 'timer'}`, `time={current.subtitle}`, tone from `current.toneId`.

- [ ] **Step 1: Write a small unit test for building/deduping alert items (optional helper)**

If you extract `dedupeEnqueue(prev, items): AlertQueueItem[]` into `src/alarms/alertQueue.ts`, test it:

```ts
import { describe, expect, it } from 'vitest';
import { dedupeEnqueue } from './alertQueue';
import type { AlertQueueItem } from './alertTypes';

const item = (id: string): AlertQueueItem => ({
  kind: 'timer',
  id,
  label: 'T',
  subtitle: '0:00',
  toneId: 'chime',
});

describe('dedupeEnqueue', () => {
  it('skips duplicate ids', () => {
    const next = dedupeEnqueue([item('a')], [item('a'), item('b')]);
    expect(next.map((i) => i.id)).toEqual(['a', 'b']);
  });
});
```

Otherwise skip this file and cover behavior manually in Step 4.

- [ ] **Step 2: Refactor `AlarmRuntime.tsx` to the behavior above**

Keep the public import path working:

```ts
export function AlertRuntime(props: Props) { /* ... */ }
export { AlertRuntime as AlarmRuntime };
```

Update `DisplayViewer` import to `AlertRuntime` when wiring (Task 5).

- [ ] **Step 3: Run existing schedule tests + new queue test**

Run: `npm run test:run -- src/alarms/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/alarms/AlarmRuntime.tsx src/alarms/alertQueue.ts src/alarms/alertQueue.test.ts src/alarms/alertTypes.ts
git commit -m "Generalize alarm runtime into shared alert queue."
```

---

### Task 4: TimersContext

**Files:**
- Create: `src/timers/TimersContext.tsx`

**Interfaces:**
- Consumes: format helpers, `AlertQueueItem`, `uuid` (`uuid` package already used by alarms)
- Produces:
  - `TimersProvider({ children })`
  - `useTimers()` → `{ runtimes, startFromPreset, startFromFields, pause, resume, cancel, registerEnqueue, restartFromAlert }`

**Implementation sketch:**

```tsx
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

  const startFromPreset = useCallback(
    (preset: TimerPreset) => {
      startFromFields({
        label: preset.label,
        durationSeconds: preset.durationSeconds,
        toneId: preset.toneId,
        presetId: preset.id,
      });
    },
    [startFromFields],
  );

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
    setRuntimes((prev) => prev.map((r) => (r.id === id ? pauseRuntime(r, now) : r)));
  }, []);

  const resume = useCallback((id: string) => {
    const now = Date.now();
    setRuntimes((prev) => prev.map((r) => (r.id === id ? resumeRuntime(r, now) : r)));
  }, []);

  const cancel = useCallback((id: string) => {
    completedRef.current.delete(id);
    setRuntimes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const now = Date.now();
      setRuntimes((prev) => {
        const still: TimerRuntime[] = [];
        for (const r of prev) {
          if (r.status === 'paused') {
            still.push(r);
            continue;
          }
          if (!isRuntimeComplete(r, now)) {
            still.push({ ...r, remainingMs: remainingMs(r, now) });
            continue;
          }
          if (completedRef.current.has(r.id)) continue;
          completedRef.current.add(r.id);
          enqueueRef.current?.({
            kind: 'timer',
            id: `timer|${r.id}`,
            label: r.label,
            subtitle: '0:00',
            toneId: r.toneId,
            timer: {
              runId: r.id,
              durationSeconds: r.durationSeconds,
              label: r.label,
              toneId: r.toneId,
              presetId: r.presetId,
            },
          });
          // drop completed runtime
        }
        return still;
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
  const ctx = useContext(TimersContext);
  if (!ctx) {
    throw new Error('useTimers must be used within TimersProvider');
  }
  return ctx;
}
```

**Note:** Prefer ~250ms tick for smoother UI; completion still deduped via `completedRef`.

- [ ] **Step 1: Implement `TimersContext.tsx` as above**

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --pretty false 2>&1 | head -40`
Expected: clean for new file

- [ ] **Step 3: Commit**

```bash
git add src/timers/TimersContext.tsx
git commit -m "Add TimersContext for session countdown runtimes."
```

---

### Task 5: TimersWidget + Registry

**Files:**
- Create: `src/widgets/TimersWidget.tsx`
- Create: `src/widgets/TimersWidget.module.css`
- Modify: `src/widgets/registry.ts`

**Interfaces:**
- Consumes: `useTimers`, `TimerPreset`, `ALARM_TONE_OPTIONS`, `formatDurationMs`, `remainingMs`
- Produces: registered widget type `timers`

- [ ] **Step 1: Implement widget UI**

`TimersWidget.tsx` responsibilities:

1. Read `presets` from `widget.config` (default `[]`); coerce invalid entries out when rendering.
2. **Active section:** for each `runtimes` entry show label, `formatDurationMs(remainingMs(r, Date.now()))` (refresh via local 250ms state tick or rely on context updates), Pause/Resume, Cancel.
3. **Presets section:** list with Start / Edit fields (label, duration minutes+seconds or total seconds input, tone Select) / Delete; Add button creates `{ id: uuid, label: 'Timer', durationSeconds: 300, toneId: 'chime' }`.
4. Persist presets via `onConfigChange({ presets: next })`.
5. Empty state when no presets and no runtimes: “Add a timer to get started” + Add control.
6. Settings component: transparent background switch + short help text (same pattern as Alarms).
7. If `useTimers` throws outside provider, catch is unnecessary if providers wrap both editor and viewer (Task 6). Widget may assume provider exists.

CSS: mirror `AlarmsWidget.module.css` (`.container`, `.transparent`, list spacing).

- [ ] **Step 2: Register in `registry.ts`**

```ts
import type { TimersConfig } from './TimersWidget'; // export alias of TimersWidgetConfig & WidgetConfig
import { IconHourglass } from '@tabler/icons-react'; // or IconTimer

const TimersWidget = lazy(() => import('./TimersWidget').then((m) => ({ default: m.TimersWidget })));
const TimersWidgetSettings = lazy(() =>
  import('./TimersWidget').then((m) => ({ default: m.TimersWidgetSettings })),
);

const timersEntry: WidgetRegistryEntry<TimersConfig> = {
  type: 'timers',
  name: 'Timers',
  description: 'Countdown timers with shared display alerts',
  icon: IconHourglass,
  component: TimersWidget,
  settingsComponent: TimersWidgetSettings,
  defaultConfig: {
    presets: [],
    transparentBackground: false,
  },
  defaultLayout: { w: 3, h: 3, minW: 2, minH: 2 },
};
setWidgetEntry('timers', timersEntry);
```

Export `TimersConfig` from the widget file as `TimersWidgetConfig & WidgetConfig` fields.

- [ ] **Step 3: Commit**

```bash
git add src/widgets/TimersWidget.tsx src/widgets/TimersWidget.module.css src/widgets/registry.ts
git commit -m "Add Timers widget and registry entry."
```

---

### Task 6: Wire Providers And AlertRuntime

**Files:**
- Modify: `src/components/DisplayViewer.tsx`
- Modify: `src/pages/ViewEditorPage.tsx`
- Modify: `src/alarms/AlarmRuntime.tsx` (if DisplayViewer needs `onRegisterEnqueue` / `onTimerRestart` props finalized)

**Wiring (DisplayViewer):**

```tsx
import { TimersProvider, useTimers } from '../timers/TimersContext';
import { AlertRuntime } from '../alarms/AlarmRuntime';

// Inside DisplayViewer return, nest:
<DisplayProvider>
  <TimersProvider>
    <AlarmsProvider alarms={alarms} readOnly>
      {/* existing UI */}
      {!isPreview && (
        <AlertRuntimeBridge
          alarms={alarms}
          enabled={!passcodeRequired}
          voiceEnabled={config?.voiceEnabled ?? false}
        />
      )}
    </AlarmsProvider>
  </TimersProvider>
</DisplayProvider>
```

Create a small inner component in the same file (or `src/alarms/AlertRuntimeBridge.tsx`):

```tsx
function AlertRuntimeBridge(props: {
  alarms: AlarmDefinition[];
  enabled: boolean;
  voiceEnabled: boolean;
}) {
  const { registerEnqueue, restartFromAlert } = useTimers();
  return (
    <AlertRuntime
      {...props}
      onRegisterEnqueue={(fn) => registerEnqueue(fn)}
      onTimerRestart={restartFromAlert}
    />
  );
}
```

On `AlertRuntime` unmount, ensure `registerEnqueue(null)` so editor-only sessions without runtime do not keep a stale fn (viewer only mounts runtime when `!isPreview`).

**ViewEditorPage:** wrap Dashboard:

```tsx
<TimersProvider>
  <AlarmsProvider ...>
    <Dashboard ... />
  </AlarmsProvider>
</TimersProvider>
```

No `AlertRuntime` in the editor.

- [ ] **Step 1: Implement wiring**

- [ ] **Step 2: Run unit tests**

Run: `npm run test:run -- src/timers/ src/alarms/`
Expected: PASS

- [ ] **Step 3: Typecheck / build**

Run: `npm run build`
Expected: success

- [ ] **Step 4: Commit**

```bash
git add src/components/DisplayViewer.tsx src/pages/ViewEditorPage.tsx src/alarms/AlarmRuntime.tsx
git commit -m "Wire TimersProvider and shared AlertRuntime on the display."
```

---

### Task 7: Manual Verification Checklist

No code required unless bugs found.

- [ ] **Step 1: Manual checks on live display (`!preview`)**

1. Add Timers widget; create preset (e.g. 5s for test); Start → countdown updates.
2. Pause / Resume / Cancel work.
3. Let timer hit 0 → dialog + tone; Dismiss clears.
4. Complete again → Snooze 5 → dialog returns later without starting a new countdown in the widget until Restart.
5. Complete → Restart → new countdown starts; dialog closes.
6. Start two short timers → both can finish; second waits in queue.
7. Start timer, rotate to another view without Timers widget → alert still appears.
8. With `voiceEnabled`, say dismiss/snooze phrases during timer alert.
9. Management preview / view editor: start timer OK; **no** dialog/sound.
10. Reload display: presets remain; running timers gone.

- [ ] **Step 2: Fix any defects found; commit with focused messages**

- [ ] **Step 3: Final commit if needed**

```bash
git status
# only commit intentional fixes
```

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|------------------|------|
| Hybrid architecture / shared AlertRuntime | 3, 6 |
| Persisted presets in widget config | 5 |
| Session-only runtimes | 4 |
| Multiple concurrent + FIFO with alarms | 3, 4 |
| Pause/resume/cancel | 1, 4, 5 |
| Dismiss / snooze / restart / mute / voice | 2, 3, 6 |
| No alert in preview | 6 |
| Survive view rotation | 4, 6 (`TimersProvider` above Dashboard) |
| Out of scope items omitted | — |

## Placeholder / Consistency Check

- Types use `durationSeconds`, `toneId`, `AlertQueueItem.timer.runId` consistently across tasks.
- `AlarmRuntime.tsx` filename kept; component exported as `AlertRuntime`.
- No dedicated PATCH API or Display Detail timers block.
