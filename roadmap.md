# Homeslate Roadmap

Simple roadmap focused on milestones and clear prioritization.

## Priority Levels

- `P0` = critical foundation / daily-use value
- `P1` = high-impact improvements
- `P2` = nice-to-have / longer-term expansion

## Milestone 1: Foundation and Reliability (Now -> 4 weeks)

Goal: make the display dependable for daily family use.

### `P0`
- [x] Standardize widget states: loading, empty, error, and offline fallback.
- [x] Add "last updated" timestamp pattern to all data widgets.
- [x] Improve refresh/caching behavior to avoid blank widgets on API hiccups.
- [x] Add basic preset view templates (Morning, Evening, Weekend).

### `P1`
- [x] Improve overall kiosk resilience (auto-recover from failed widget fetches).
- [x] Add a simple widget health/status indicator in editor mode.

### `P2`
- Add more granular per-widget refresh interval options.

## Milestone 2: Core Family Workflows (4 -> 8 weeks)

Goal: expand from "info display" to "daily household command center."

### `P0`
- Add **Groceries Widget** (shared list, quick check-off).
- Add **Meal Plan Widget** (weekly meals and notes).
- Upgrade **Todo Widget** with due dates and recurring items.
- Improve **Calendar widgets** with conflict highlighting and better upcoming grouping.

### `P1`
- Add **Countdowns Widget** (events, birthdays, vacations).
- Add **School Widget** (calendar feed + key school dates).

### `P2`
- Add simple household routine templates (School Day, Weekend, Travel Prep).

## Milestone 3: Integrations and Automation (8 -> 12 weeks)

Goal: deeper utility through integrations and smart behavior.

### `P0`
- Add **Transit/Commute Widget** (ETA to saved destinations).
- Add **Package Tracking Widget** (upcoming deliveries summary).
- Add time-based view rotation rules (morning/day/evening schedule).

### `P1`
- Add basic smart home status widget (via Home Assistant style API).
- Add weather alert emphasis mode (severe weather takeover banner/view).

### `P2`
- Add presence-based view logic (weekday/weekend/away profiles).

## Milestone 4: Platform and Ecosystem (12+ weeks)

Goal: make the platform easier to scale, share, and extend.

### `P0`
- Add role-aware collaboration controls (owner/editor/viewer).
- Add import/export for display configs and view templates.

### `P1`
- Publish widget development guide and starter template.
- Add shareable theme/layout packs.

### `P2`
- Explore community widget catalog/marketplace model.

## Prioritized Widget Backlog (Quick Reference)

1. `P0` Groceries
2. `P0` Meal Plan
3. `P0` Todo enhancements (due dates/recurring)
4. `P0` Calendar enhancements
5. `P0` Transit/Commute
6. `P0` Package Tracking
7. `P1` Countdowns
8. `P1` School
9. `P1` Smart Home Status
10. `P2` Energy/utility insights

## Definition of Done (per milestone)

- Features are usable in both editor and viewer experiences.
- Error and empty states are handled gracefully.
- Performance remains smooth on always-on display hardware.
- Documentation is updated for new widgets/settings.
