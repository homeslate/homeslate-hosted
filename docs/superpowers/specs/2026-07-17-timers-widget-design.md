# Timers Widget Design

## Goal

Let users add and manage countdown timers from a Timers widget on a Homeslate display. When a timer reaches zero, the live display shows the same fullscreen alert dialog and tone pipeline used by alarms (dismiss, snooze, mute, voice), plus a timer-specific Restart action. Timers can finish and alert even if the user has rotated away from the Timers widget.

## Decisions

| Topic | Choice |
|-------|--------|
| Who hears it | Physical display (`DisplayViewer` only; not management preview) |
| Management UI | Timers widget only (no Display Detail settings block in v1) |
| Architecture | Hybrid: presets in widget config; session runtimes in context; shared display-level alert runtime |
| Concurrent timers | Multiple named timers can run in parallel; alerts share one FIFO queue with alarms |
| Running-state persistence | Session-only — reload loses in-progress countdowns |
| Preset persistence | Yes — label, duration, tone in `widget.config.presets` |
| While running | Pause / resume + cancel |
| On complete | Dismiss, snooze (5/10/15), restart (same duration), mute |
| Sound | Reuse alarm tones (`chime` / `bell` / `radar`) selectable per preset |
| Voice | Reuse alarm dismiss/snooze phrases when display voice is enabled; Restart is button-only |

## Chosen Approach

**Shared alert runtime (Approach 1).** Evolve `AlarmRuntime` into a shared `AlertRuntime` that rings for both alarms and timers. The Timers widget owns persisted presets and exposes start/pause/resume/cancel for session runtimes via `TimersContext`. On countdown complete, the context enqueues a timer alert into the shared runtime (same `AlarmDialog`, tones, and voice hooks).

Rejected alternatives:

- **Separate `TimerRuntime` beside `AlarmRuntime`** — duplicates queue/dialog/tone/voice and risks two competing overlays.
- **Widget-local firing only** — alerts would stop if the widget is off the current rotated view.
- **Inject synthetic alarms into the existing alarm scheduler** — schedule-based model fits timers poorly (pause, restart, multi-run).

## Data Model

### Persisted (widget config)

```ts
type AlarmToneId = 'chime' | 'bell' | 'radar';

interface TimerPreset {
  id: string;
  label: string;
  durationSeconds: number;
  toneId: AlarmToneId;
}

interface TimersWidgetConfig {
  presets: TimerPreset[];
  transparentBackground?: boolean;
}
```

Presets sync with layout JSON via the existing config upsert / store save path. No new Netlify function or top-level display `timers` field in v1.

### Session-only (TimersContext)

```ts
interface TimerRuntime {
  id: string;                 // unique run id
  presetId?: string;          // if started from a preset
  label: string;
  durationSeconds: number;    // original length (for Restart)
  toneId: AlarmToneId;
  endsAt: number;             // epoch ms; ignored while paused
  remainingMs: number;        // authoritative while paused
  status: 'running' | 'paused';
}
```

### Shared alert queue

```ts
type AlertKind = 'alarm' | 'timer';

interface AlertQueueItem {
  kind: AlertKind;
  id: string;                 // occurrence / run key
  label: string;
  subtitle: string;           // clock time for alarms; e.g. "0:00" for timers
  toneId: AlarmToneId;
  /** Timer-only metadata for Restart / snooze re-queue */
  timer?: {
    runId: string;
    durationSeconds: number;
    presetId?: string;
  };
}
```

Timer snoozes use a session map `runId → fireAt` (same idea as alarm snoozes). Snooze re-enqueues the alert; it does **not** auto-start a new countdown. Restart starts a fresh `TimerRuntime` with the same duration/label/tone, then dismisses the dialog.

## Architecture

```text
TimersWidget (presets + start/pause/cancel UI)
        │
        ├─► widget.config.presets  →  layout save / config upsert
        │
        └─► TimersContext (session runtimes)
                  │
                  └─ on complete → AlertRuntime enqueue
                                        ├─ AlarmDialog (+ Restart for timers)
                                        ├─ tones.ts
                                        └─ voice (dismiss / snooze)
```

`TimersProvider` mounts around the dashboard surface used by both the live viewer and the view editor so the widget can start/pause timers for smoke-testing in the editor, and so runtimes survive view rotation when the Timers widget unmounts. `AlertRuntime` mounts only for the live display (`!isPreview`).

**Enqueue wiring:** `AlertRuntime` registers an `enqueueAlert(item)` callback into `TimersContext` (or a thin shared alerts bridge). On complete, the context calls that callback. When no runtime is mounted (editor/preview), complete is a no-op for alerting — the finished runtime is simply removed.

### Components / modules

| Piece | Responsibility |
|-------|----------------|
| `src/widgets/TimersWidget.tsx` (+ CSS / settings) | Preset CRUD + active timer list UI |
| `src/timers/types.ts` | Preset + runtime types |
| `src/timers/TimersContext.tsx` | Session runtimes: start / pause / resume / cancel / tick → complete |
| `src/timers/format.ts` | mm:ss helpers |
| `src/alarms/AlertRuntime.tsx` (evolve `AlarmRuntime`) | Shared queue, dialog host, tones, voice; alarm schedule tick + timer feed |
| `src/alarms/AlarmDialog.tsx` | Add optional Restart when `kind === 'timer'` |
| `registry.ts` | Register `timers` widget |
| Voice | Reuse `useAlarmVoiceCommands` for dismiss/snooze on timer alerts |

### Config plumbing

- Widget registration: `defaultConfig: { presets: [], transparentBackground: false }` and a default grid layout similar to Alarms.
- Preset edits write through `onConfigChange` → existing layout save.
- No Zod/display-config schema change required for presets (they live inside widget config JSON). Alert runtime refactor stays client-side.

## UI Surfaces

### Timers widget

- **Presets:** label, duration, tone; Start / Edit / Delete; Add preset form (label, duration, tone picker).
- **Active timers:** countdown, Pause/Resume, Cancel; multiple concurrent.
- Starting a preset creates a new session runtime; the preset remains. The same preset may be started more than once (separate run ids).
- Empty state: short prompt + “Add timer”.
- Editor (`isEditing`): full preset CRUD; countdown controls may work for smoke-testing, but alerts remain disabled outside the live viewer.

### Alert dialog (shared)

| Action | Alarm | Timer |
|--------|-------|-------|
| Dismiss | Clear from queue | Clear from queue; no runtime left |
| Snooze (5/10/15) | Re-fire later | Re-fire later with same timer metadata |
| Restart | — | Start new session runtime with same duration/label/tone; dismiss dialog |
| Mute | Current ring only | Current ring only |
| Voice | Dismiss / snooze | Same; Restart button-only |

## Firing Rules

1. **Tick:** `TimersContext` updates remaining time ~1s while any timer is `running`.
2. **Complete:** When `remainingMs` / `endsAt` reaches zero, remove the runtime and enqueue one timer alert (dedupe by run id so a tick cannot double-fire).
3. **Pause:** Freeze `remainingMs`; clear active `endsAt` use. **Resume:** set `endsAt = now + remainingMs`.
4. **Cancel:** Drop runtime without enqueueing.
5. **Queue:** One dialog at a time; timer and alarm items share FIFO order.
6. **Widget visibility:** Completion alerts fire even if the Timers widget is not on the current view.
7. **Preview:** No dialog or sound in management preview / editor.
8. **Sound / autoplay:** Same behavior as alarms (loop tone; silent dialog if autoplay blocked).

## Edge Cases And Errors

- Display reload → all session runtimes and timer snoozes lost; presets unchanged.
- Timer completes while another alert is showing → enqueue; show after current dismiss/snooze/restart.
- Invalid `toneId` → default `chime`.
- Corrupt `durationSeconds` (≤ 0 or non-finite) → reject start; do not crash runtime.
- Preset deleted while a run from that preset is active → run continues with copied label/duration/tone.
- Audio failure → dialog still works (same as alarms).

## Out Of Scope (v1)

- Persisting running timers across reload
- Stopwatch mode
- Display Detail settings page for timers
- Dedicated PATCH / timers API
- Voice command for Restart
- Custom audio URLs
- Push notifications when the display tab is closed

## Testing

**Unit**

- Duration formatting (mm:ss)
- Pause / resume remaining math
- Complete enqueues exactly once (no double-fire)
- AlertRuntime accepts timer queue items
- Restart creates a new runtime and clears the dialog
- Snooze re-queues a timer alert without starting a countdown

**Manual**

- Multi-timer finish while a dialog is open (FIFO)
- Rotate away from Timers widget; alert still appears
- Management / preview does not ring
- Preset CRUD persists after config poll
- Voice dismiss/snooze works for timer alerts when voice is enabled
