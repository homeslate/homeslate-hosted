# Recurring Alarms Design

## Goal

Let a Homeslate physical display ring a dismissible, snoozable alarm dialog with sound on a recurring schedule (e.g. 7pm every day). Users manage alarms from an Alarms widget and from Display Detail settings. Alarms are display-scoped and only interrupt the live display viewer — not phone previews or other browsers viewing the same display.

## Decisions

| Topic | Choice |
|-------|--------|
| Who hears it | Physical display (`DisplayViewer` only; not management preview) |
| Management UI | Both Alarms widget and Display Detail → Settings |
| Recurrence (v1) | Daily + selected weekdays |
| Storage | Display config JSON (`alarms` array), existing config poll/upsert |
| Snooze | Chooser: 5 / 10 / 15 minutes |
| Sound | Three built-in tones selectable per alarm |
| Dialog content | Label + time |
| Architecture | Display-runtime scheduler + config-backed list (not widget-owned firing) |

## Chosen Approach

Store alarm definitions on the display config. Mount an `AlarmRuntime` inside `DisplayViewer` that evaluates the clock, shows a fullscreen dialog, plays the selected tone, and handles dismiss/snooze. Share one `AlarmListEditor` between the widget and management settings.

Snooze and “already handled this occurrence” state stay in session memory so ringing/snoozing does not write config.

Rejected alternatives:

- **Widget-owned firing** — alarms would silently stop if the widget is removed from the layout.
- **Dedicated alarms API/table** — more infra than needed when config JSON already syncs to the display.

## Data Model

Top-level on display config (alongside `layouts`, `themes`, etc.):

```ts
type AlarmToneId = 'chime' | 'bell' | 'radar';

interface AlarmDefinition {
  id: string;
  label: string;
  enabled: boolean;
  time: string;       // "HH:mm", local to the display device
  days: number[];     // 0=Sun … 6=Sat; empty or length 7 = every day
  toneId: AlarmToneId;
}

// DisplayConfig
alarms?: AlarmDefinition[];
```

Session-only runtime state (not persisted):

```ts
interface AlarmRuntimeState {
  /** Keys of occurrences already dismissed or consumed: `${alarmId}|${YYYY-MM-DD}|${HH:mm}` */
  handledOccurrenceKeys: Set<string>;
  /** Active ring queue (alarm ids / occurrence keys), max one dialog at a time */
  queue: Array<{ alarmId: string; occurrenceKey: string }>;
  snoozes: Record<string, number>; // alarmId -> fireAt epoch ms
  mutedForCurrentRing: boolean;
}
```

## Architecture

```text
display config.alarms
        │
        ├─► AlarmListEditor  (widget + Display Detail settings)
        │         │
        │         └─► existing config upsert / store save
        │
        └─► AlarmRuntime (DisplayViewer only)
                  ├─ clock tick (~1s)
                  ├─ match schedule + grace window
                  ├─ AlarmDialog (dismiss / snooze / mute)
                  └─ tone playback (built-in assets)
```

### Components / modules

| Piece | Responsibility |
|-------|----------------|
| `AlarmRuntime` | Tick loop, occurrence matching, queue, snooze timers, dialog host |
| `AlarmDialog` | Fullscreen UI: label, time, Dismiss, Snooze (5/10/15), mute |
| `AlarmListEditor` | Shared CRUD list + edit form (label, time, days, tone, enabled) |
| `AlarmsWidget` + settings | Optional on-dashboard management surface |
| Tone assets / helper | Map `toneId` → audio URL; play/loop/stop |
| Pure schedule helpers | Match, occurrence key, grace window — unit tested |

### Config plumbing

- Extend dashboard store and viewer/detail config types with `alarms`.
- Persist via existing config upsert; no new Netlify function or table.
- Viewer poll already refreshes config; treat remote updates carefully while ringing (see Edge Cases).

## UI Surfaces

### Alarm dialog

- Fullscreen modal over the current view.
- Large label + time.
- Primary **Dismiss**.
- **Snooze** reveals 5 / 10 / 15 minute choices (large kiosk tap targets).
- Mute/unmute affects the current ring only (does not change saved `toneId`).
- Mounted only for the live display viewer (`isPreview` false).

### Alarms widget

- List rows: label, time, days summary, enabled toggle.
- Tap row to edit; add/delete supported.
- Writes through the same config save path as other display settings.
- Presence of the widget is not required for firing.

### Display Detail → Settings

- “Alarms” block using the same `AlarmListEditor`.
- Full CRUD without placing a widget on a layout.

## Firing Rules

1. **Match:** Enabled alarm, current local weekday in `days` (or every day if `days` empty/all), local time equals `time` (minute precision).
2. **Occurrence key:** `${alarmId}|${YYYY-MM-DD}|${HH:mm}` — each key fires at most once until snooze requeues.
3. **Grace window:** If the tick arrives late, still fire within 60 seconds after the target minute. Outside that window, skip — no backlog when the tab was closed.
4. **Snooze:** Session override `fireAt`; scheduled occurrence marked handled; at `fireAt`, enqueue the same alarm again. Dismiss clears snooze for that alarm.
5. **Queue:** One dialog at a time. Same-minute collisions enqueue; after dismiss/snooze, show the next.
6. **Timezone:** Device local time only in v1.
7. **Sound:** Loop selected built-in tone. If autoplay is blocked, keep the dialog visible and show a silent cue; unmute tap uses the user gesture to start audio.

## Edge Cases And Errors

- Alarm deleted or disabled while ringing/snoozed → stop ring / drop snooze for that id.
- Config poll updates other alarms while one is ringing → apply list changes without closing an active ring unless that alarm was removed/disabled.
- Invalid `toneId` → default `chime`.
- Corrupt `time` / `days` → skip that alarm; runtime must not crash.
- Audio load failure → dialog still works; hide or disable mute if there is nothing to play.
- Preview / management routes → no `AlarmRuntime` dialog or sound.

## Out Of Scope (v1)

- Push notifications when the display tab is closed
- One-time date alarms, monthly/custom intervals
- Custom audio URLs
- Per-alarm timezones
- Server-side alarm history or analytics
- Phone/preview devices ringing for the same display

## Testing

**Unit**

- Weekday / every-day matching and `enabled` gating
- Occurrence key uniqueness (same alarm next day can fire again)
- Grace window accept vs skip-on-miss
- Snooze `fireAt` scheduling and clear on dismiss
- Same-minute queue ordering

**Manual**

- Paired display: ring, mute, dismiss, snooze 5/10/15
- Alarm still fires when Alarms widget is not on the active layout
- Management / preview does not ring
- Edit from Display Detail and from widget both persist and appear on the display after config poll
