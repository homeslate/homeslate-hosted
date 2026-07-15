# Weather Widget Layout Design

## Goal

Fix the weather widget so the hourly strip shows the next 12 hours from the current hour, and so current / details / hourly / weekly sections stack cleanly at common grid sizes without overlapping text.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Tight layout pass (data fix + size-aware layout), not a visual redesign |
| Hourly start | Current clock hour (e.g. 2:20 PM → first card “2 PM”) |
| Shortfall | If fewer than 12 hours remain in the feed, show what is available; never wrap to earlier hours |
| Size strategy | Explicit compact / medium / full tiers that show or hide sections |
| Cut priority when space is tight | Weekly → details/AQI → hourly → compact current-only |
| Overlap strategy | Fix stacking/flex (no absolute collisions); horizontal scroll for hour cards rather than crushing labels |
| Visual language | Keep existing gradient, icons, cards, tokens |
| Out of scope | New settings, new sections, icon/color redesign |

## Chosen Approach

**Size breakpoints + correct hourly slice.**

1. In `fetchWeather`, locate the first hourly index at or after “now” (Open-Meteo times already use `timezone=auto`), then take the next 12 entries (or fewer if the array ends).
2. In `WeatherWidget`, replace ad-hoc `isCompact` / `isSmallWidget` flags with three tiers driven by grid `w` × `h`, and render sections according to the cut priority above.
3. Adjust CSS so the header/status, current block, hourly strip, and weekly row are a normal column stack with reserved space — `.current` must not use `flex: 1` + vertical centering in a way that collides with siblings. Alignment (`left` / `center` / `right`) only changes alignment, not stack order.

Rejected alternatives:

- **CSS-only reflow** — keeps all sections visible; still overlaps or crushes content at small sizes.
- **Always full + internal scroll** — poor for wall displays; content below the fold is easy to miss.

## Architecture

```text
Open-Meteo hourly[]  →  slice from current hour (12)  →  WeatherData.hourly

WeatherWidget (layout.w / layout.h)
  → tier = compact | medium | full
  → render:
       compact: icon + temp (+ location if width allows)
       medium:  location, updated, current, details; hourly if height allows; no weekly
       full:    current + details + hourly + weekly
```

### Modules

| Module | Responsibility |
|--------|----------------|
| `src/services/weather.ts` | Slice hourly from current hour; keep comment/types accurate |
| `src/widgets/WeatherWidget.tsx` | Derive size tier; conditionally render sections |
| `src/widgets/WeatherWidget.module.css` | Column stack without overlap; hour-card min sizes / scroll |

### Size tiers

| Tier | When | Shows |
|------|------|--------|
| Compact | `h ≤ 2` | Icon + temperature; location when width allows |
| Medium | Above compact, not enough room for full | Location, updated status, current, details; hourly when height allows; no weekly |
| Full | Enough width and height | Current + details (+ AQI if enabled) + hourly + weekly (when `showForecast`) |

Exact `w`/`h` cutoffs for medium vs full are implementation details, but must match the cut priority and eliminate the overlapping states seen in screenshots (status under icon, “Next 12 hours” through details).

### Layout polish

1. **Header block** — location + “Updated …” occupy one top stack with reserved space.
2. **Current block** — icon + temp + condition on one row; humidity / wind / feels on the next; AQI below.
3. **Hourly strip** — cards get sufficient min-width/padding so labels like “12 AM” do not clip; horizontal scroll if needed.
4. **Weekly** — same visual treatment; only in full tier (and when forecast is enabled).
5. **Alignment** — existing left/center/right classes remain alignment-only.

## Edge Cases

- Hourly feed starts at local midnight: start index is found by comparing timestamps to now, not by assuming index 0 is current.
- Near end of forecast window: show remaining hours (fewer than 12).
- Compact height: never show hourly/weekly/details in ways that overlap current temp.
- Center/right text align: no change to vertical order or overlapping.
- Air quality badge: follows details; hidden when details are cut.

## Testing

- Unit: hourly slice helper — at a fixed “now”, first entry is the current hour; before current hour is excluded; short arrays return available length.
- Manual: resize widget across compact / medium / full — no overlapping labels; at ~2 PM, hourly starts at “2 PM”; weekly appears only in full tier.

## Non-Goals

- Redesigning weather icons, palette, or card chrome
- Changing forecast-day settings or location search UX
- Server-side weather caching changes beyond the hourly slice
