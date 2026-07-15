# Weather Widget Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slice hourly weather from the current hour (next 12), and fix weather-widget stacking so compact / medium / full grid sizes never overlap text.

**Architecture:** Extract a pure `sliceHourlyFromNow` helper (unit-tested), use it in `fetchWeather`, then replace ad-hoc size flags in `WeatherWidget` with an explicit size tier and CSS that stacks sections without `flex: 1` collision.

**Tech Stack:** TypeScript, React, CSS modules, Vitest, Open-Meteo hourly times (`timezone=auto`).

## Global Constraints

- Hourly starts at the **current clock hour** (e.g. 2:20 PM → first card “2 PM”)
- Take at most **12** hours; if fewer remain in the feed, show what is available; never wrap earlier
- Size cut priority: **weekly → details/AQI → hourly → compact current-only**
- Keep existing visual language (gradient, icons, cards, tokens)
- Alignment is alignment-only — does not change vertical stack order
- No new settings, sections, or palette/icon redesign

## File Structure

| File | Responsibility |
|------|----------------|
| Create: `src/services/hourlyForecast.ts` | Pure helper to find start index and slice next N hours |
| Create: `src/services/hourlyForecast.test.ts` | Unit tests for slice behavior |
| Modify: `src/services/weather.ts` | Call helper when building `hourly` |
| Create: `src/widgets/weatherSizeTier.ts` | Map `w`/`h` → `compact` \| `medium` \| `full` + section visibility |
| Create: `src/widgets/weatherSizeTier.test.ts` | Unit tests for tier cutoffs / visibility |
| Modify: `src/widgets/WeatherWidget.tsx` | Use tier for conditional render; keep settings unchanged |
| Modify: `src/widgets/WeatherWidget.module.css` | Column stack without overlap; hour-card min sizes |

---

### Task 1: Hourly slice helper + tests

**Files:**
- Create: `src/services/hourlyForecast.ts`
- Test: `src/services/hourlyForecast.test.ts`

**Interfaces:**
- Produces:
  - `findHourlyStartIndex(times: string[], now: Date): number` — first index whose hour start is `>=` the start of `now`'s local hour; if none, returns `times.length`
  - `sliceHourlyFromNow<T>(args: { times: string[]; values: T[]; now: Date; count?: number }): T[]` — slices `values` from start index for `count` (default 12); length may be `< count`
- Consumes: none (pure)

- [ ] **Step 1: Write the failing tests**

Create `src/services/hourlyForecast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findHourlyStartIndex, sliceHourlyFromNow } from './hourlyForecast';

describe('findHourlyStartIndex', () => {
  it('returns index of current hour', () => {
    const times = [
      '2026-07-15T12:00',
      '2026-07-15T13:00',
      '2026-07-15T14:00',
      '2026-07-15T15:00',
    ];
    const now = new Date(2026, 6, 15, 14, 20, 0); // Jul 15 2026 2:20 PM local
    expect(findHourlyStartIndex(times, now)).toBe(2);
  });

  it('skips hours before now', () => {
    const times = [
      '2026-07-15T00:00',
      '2026-07-15T01:00',
      '2026-07-15T02:00',
    ];
    const now = new Date(2026, 6, 15, 2, 5, 0);
    expect(findHourlyStartIndex(times, now)).toBe(2);
  });

  it('returns length when all hours are in the past', () => {
    const times = ['2026-07-15T00:00', '2026-07-15T01:00'];
    const now = new Date(2026, 6, 15, 14, 0, 0);
    expect(findHourlyStartIndex(times, now)).toBe(2);
  });
});

describe('sliceHourlyFromNow', () => {
  it('returns up to count when more hours exist', () => {
    const times = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(2026, 6, 15, 0, 0, 0);
      d.setHours(i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:00`;
    });
    const values = times.map((_, i) => i);
    const now = new Date(2026, 6, 15, 14, 20, 0);
    expect(sliceHourlyFromNow({ times, values, now, count: 12 })).toEqual([
      14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    ]);
  });

  it('returns fewer than count near end of feed', () => {
    const times = ['2026-07-15T22:00', '2026-07-15T23:00'];
    const values = ['a', 'b'];
    const now = new Date(2026, 6, 15, 22, 10, 0);
    expect(sliceHourlyFromNow({ times, values, now, count: 12 })).toEqual(['a', 'b']);
  });

  it('returns empty when times empty', () => {
    expect(sliceHourlyFromNow({ times: [], values: [], now: new Date(), count: 12 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/services/hourlyForecast.test.ts`

Expected: FAIL (module not found / cannot resolve `./hourlyForecast`)

- [ ] **Step 3: Implement helper**

Create `src/services/hourlyForecast.ts`:

```ts
function startOfLocalHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

/**
 * Open-Meteo hourly times are local wall times like "2026-07-15T14:00"
 * (no Z) when timezone=auto. Parse with Date so comparison uses local clock.
 */
export function findHourlyStartIndex(times: string[], now: Date): number {
  const threshold = startOfLocalHour(now).getTime();
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    if (!Number.isNaN(t) && t >= threshold) return i;
  }
  return times.length;
}

export function sliceHourlyFromNow<T>(args: {
  times: string[];
  values: T[];
  now: Date;
  count?: number;
}): T[] {
  const count = args.count ?? 12;
  const start = findHourlyStartIndex(args.times, args.now);
  return args.values.slice(start, start + count);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/services/hourlyForecast.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/hourlyForecast.ts src/services/hourlyForecast.test.ts
git commit -m "$(cat <<'EOF'
Add hourly forecast slice from the current hour.

EOF
)"
```

---

### Task 2: Wire helper into `fetchWeather`

**Files:**
- Modify: `src/services/weather.ts` (hourly mapping block ~185–193)

**Interfaces:**
- Consumes: `sliceHourlyFromNow` from `./hourlyForecast`
- Produces: `WeatherData.hourly` as next hours from now (same `HourlyForecast[]` shape)

- [ ] **Step 1: Replace midnight slice with helper**

In `src/services/weather.ts`, replace:

```ts
  // Next 12 hours from hourly arrays (API returns 168 by default)
  const hourlyCount = 12;
  const hourlyTimes = (data.hourly?.time ?? []).slice(0, hourlyCount);
  const hourly: HourlyForecast[] = hourlyTimes.map((time: string, i: number) => ({
    time,
    temperature: Math.round(data.hourly.temperature_2m[i]),
    weatherCode: data.hourly.weather_code[i],
    isDay: data.hourly.is_day[i] === 1,
  }));
```

with:

```ts
  const times: string[] = data.hourly?.time ?? [];
  const mapped: HourlyForecast[] = times.map((time: string, i: number) => ({
    time,
    temperature: Math.round(data.hourly.temperature_2m[i]),
    weatherCode: data.hourly.weather_code[i],
    isDay: data.hourly.is_day[i] === 1,
  }));
  const hourly = sliceHourlyFromNow({
    times,
    values: mapped,
    now: new Date(),
    count: 12,
  });
```

Add import:

```ts
import { sliceHourlyFromNow } from './hourlyForecast';
```

Keep the `WeatherData.hourly` comment as `// next 12 hours from now`.

- [ ] **Step 2: Sanity-check TypeScript**

Run: `npx tsc -b --pretty false`

Expected: no errors from `weather.ts` / `hourlyForecast.ts`

- [ ] **Step 3: Commit**

```bash
git add src/services/weather.ts
git commit -m "$(cat <<'EOF'
Use current-hour slice for weather hourly forecast.

EOF
)"
```

---

### Task 3: Size tier helper + tests

**Files:**
- Create: `src/widgets/weatherSizeTier.ts`
- Test: `src/widgets/weatherSizeTier.test.ts`

**Interfaces:**
- Produces:
  - `export type WeatherSizeTier = 'compact' | 'medium' | 'full'`
  - `getWeatherSizeTier(w: number, h: number): WeatherSizeTier`
  - `getWeatherSectionVisibility(tier: WeatherSizeTier): { showLocation: boolean; showUpdated: boolean; showDetails: boolean; showHourly: boolean; showWeekly: boolean }`
- Cutoffs:
  - `compact`: `h <= 2`
  - `medium`: not compact and (`h <= 3` or `w <= 3`)
  - `full`: otherwise
- Visibility:
  - compact: location only if we still want it when width allows — implement as `showLocation: w >= 2` is NOT available inside visibility helper; keep visibility tier-only: compact → all false except nothing for location; **widget** may show location in compact when `w >= 3`. Simpler: visibility returns:
    - compact: `{ showLocation: false, showUpdated: false, showDetails: false, showHourly: false, showWeekly: false }`
    - medium: `{ showLocation: true, showUpdated: true, showDetails: true, showHourly: true, showWeekly: false }`
    - full: all `true`
  - Widget compact override: if `tier === 'compact' && w >= 3`, render location above temp (optional small label)

- [ ] **Step 1: Write the failing tests**

Create `src/widgets/weatherSizeTier.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getWeatherSectionVisibility, getWeatherSizeTier } from './weatherSizeTier';

describe('getWeatherSizeTier', () => {
  it('compact when h <= 2', () => {
    expect(getWeatherSizeTier(4, 2)).toBe('compact');
    expect(getWeatherSizeTier(2, 1)).toBe('compact');
  });

  it('medium when short or narrow', () => {
    expect(getWeatherSizeTier(4, 3)).toBe('medium');
    expect(getWeatherSizeTier(3, 5)).toBe('medium');
  });

  it('full when wide and tall enough', () => {
    expect(getWeatherSizeTier(4, 4)).toBe('full');
    expect(getWeatherSizeTier(6, 5)).toBe('full');
  });
});

describe('getWeatherSectionVisibility', () => {
  it('hides everything but current chrome in compact', () => {
    expect(getWeatherSectionVisibility('compact')).toEqual({
      showLocation: false,
      showUpdated: false,
      showDetails: false,
      showHourly: false,
      showWeekly: false,
    });
  });

  it('shows hourly but not weekly in medium', () => {
    expect(getWeatherSectionVisibility('medium')).toEqual({
      showLocation: true,
      showUpdated: true,
      showDetails: true,
      showHourly: true,
      showWeekly: false,
    });
  });

  it('shows all sections in full', () => {
    expect(getWeatherSectionVisibility('full')).toEqual({
      showLocation: true,
      showUpdated: true,
      showDetails: true,
      showHourly: true,
      showWeekly: true,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/widgets/weatherSizeTier.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

Create `src/widgets/weatherSizeTier.ts`:

```ts
export type WeatherSizeTier = 'compact' | 'medium' | 'full';

export function getWeatherSizeTier(w: number, h: number): WeatherSizeTier {
  if (h <= 2) return 'compact';
  if (h <= 3 || w <= 3) return 'medium';
  return 'full';
}

export function getWeatherSectionVisibility(tier: WeatherSizeTier): {
  showLocation: boolean;
  showUpdated: boolean;
  showDetails: boolean;
  showHourly: boolean;
  showWeekly: boolean;
} {
  switch (tier) {
    case 'compact':
      return {
        showLocation: false,
        showUpdated: false,
        showDetails: false,
        showHourly: false,
        showWeekly: false,
      };
    case 'medium':
      return {
        showLocation: true,
        showUpdated: true,
        showDetails: true,
        showHourly: true,
        showWeekly: false,
      };
    case 'full':
      return {
        showLocation: true,
        showUpdated: true,
        showDetails: true,
        showHourly: true,
        showWeekly: true,
      };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/widgets/weatherSizeTier.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/widgets/weatherSizeTier.ts src/widgets/weatherSizeTier.test.ts
git commit -m "$(cat <<'EOF'
Add weather widget size tiers for progressive section visibility.

EOF
)"
```

---

### Task 4: Apply tiers + CSS stack fix in `WeatherWidget`

**Files:**
- Modify: `src/widgets/WeatherWidget.tsx`
- Modify: `src/widgets/WeatherWidget.module.css`

**Interfaces:**
- Consumes: `getWeatherSizeTier`, `getWeatherSectionVisibility` from `./weatherSizeTier`
- Produces: rendered sections match visibility; weekly also requires `showForecast`; AQI requires `showDetails && showAirQuality`

- [ ] **Step 1: Replace size flags in the widget**

Near the render path (after `if (!weather) return null`), replace:

```ts
  // Hide weekly forecast when widget is small (3x3 or smaller) to avoid crowding
  const { w, h } = widget.layout;
  const isSmallWidget = w <= 3 && h <= 3;
  const showWeeklyForecast = showForecast && !isSmallWidget;

  // Compact layout for very short widgets (row height 2) to prevent overlap
  const isCompact = h <= 2;
```

with:

```ts
  const { w, h } = widget.layout;
  const tier = getWeatherSizeTier(w, h);
  const sections = getWeatherSectionVisibility(tier);
  const isCompact = tier === 'compact';
  const showWeeklyForecast = showForecast && sections.showWeekly;
  const showCompactLocation = isCompact && w >= 3;
```

Import:

```ts
import { getWeatherSectionVisibility, getWeatherSizeTier } from './weatherSizeTier';
```

Update JSX gates:

- Header location: `{(sections.showLocation || showCompactLocation) && ( ... header ... )}`
- `WidgetDataStatus`: `{sections.showUpdated && ( <WidgetDataStatus ... /> )}`
- Details block: `{sections.showDetails && ( ... details ... )}`
- AQI: `{sections.showDetails && showAirQuality && aqData !== null && ...}`
- Hourly: `{sections.showHourly && weather.hourly.length > 0 && ( ... )}`
- Weekly: keep `{showWeeklyForecast && weather.daily.length > 1 && ( ... )}`

Keep `classes.compact` when `isCompact`.

- [ ] **Step 2: Fix CSS stacking / hour cards**

In `src/widgets/WeatherWidget.module.css`, apply these targeted changes:

1. `.container` — keep `overflow: auto`; ensure `gap: 0.5rem` between stacked children (add `gap: 0.5rem`).

2. `.current` — change from growing/centering that collides with siblings:

```css
.current {
  flex: 0 0 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0.5rem;
}
```

3. `.header` — keep; ensure `flex-shrink: 0`.

4. `.hourlySection` / `.forecast` — `flex-shrink: 0`.

5. `.forecastHour` — raise min size so labels do not crush:

```css
.forecastHour {
  flex: 0 0 auto;
  min-width: 3.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.4rem 0.35rem;
  background: var(--token-surface-card);
  border-radius: var(--token-radius-sm);
}
```

6. Ensure `.hourly` keeps `overflow-x: auto`.

7. Keep `.compact` rules; compact should not show hourly/weekly (already gated in TS).

Do not introduce `position: absolute` for status/header/current.

- [ ] **Step 3: Run unit tests**

Run: `npm run test:run -- src/services/hourlyForecast.test.ts src/widgets/weatherSizeTier.test.ts`

Expected: PASS

- [ ] **Step 4: Manual check list (document in commit body if useful)**

With `npm run dev`: set a weather location, resize grid cells:

1. At ~current clock time, hourly first card matches current hour.
2. `h <= 2`: only icon/temp (location if wide).
3. Medium (`h === 3` or `w === 3`): no weekly; no overlapping “Updated” / “Next 12 hours”.
4. Full (`w >= 4` && `h >= 4`): hourly + weekly, no overlaps.
5. Center/right align: still no overlaps.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/WeatherWidget.tsx src/widgets/WeatherWidget.module.css
git commit -m "$(cat <<'EOF'
Fix weather widget size tiers and stop section overlap.

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Hourly from current hour | Task 1–2 |
| Shortfall under 12 hours, no wrap | Task 1 |
| Size tiers compact/medium/full | Task 3–4 |
| Cut priority weekly → details → hourly → compact | Task 3 visibility + Task 4 gates |
| Header/status reserved; no status under icon | Task 4 CSS `.current` / flex |
| Hour card min-width + horizontal scroll | Task 4 CSS |
| Alignment alignment-only | Task 4 (no stack changes by align) |
| Keep visual language / no new settings | Task 4 (settings untouched) |
| Unit + manual testing | Tasks 1, 3, 4 |

No placeholders remaining.
