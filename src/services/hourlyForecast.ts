/**
 * Open-Meteo hourly times are naive location wall times like "2026-07-15T14:00"
 * (no offset/Z) when timezone=auto. They must be interpreted in the forecast
 * location's UTC offset, not the browser's local timezone, otherwise the
 * "current hour" comparison is wrong whenever the widget location's timezone
 * differs from the device.
 */

/** Parses a naive "YYYY-MM-DDTHH:mm" wall time as an absolute instant, given the offset (seconds) it is expressed in. */
function parseWallTimeMs(wallTime: string, utcOffsetSeconds: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(wallTime);
  if (!match) return NaN;
  const [, year, month, day, hour, minute] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return utcMs - utcOffsetSeconds * 1000;
}

/** Start of the current hour, expressed as an absolute instant, in the given UTC offset (seconds). */
function startOfLocationHourMs(now: Date, utcOffsetSeconds: number): number {
  const shiftedMs = now.getTime() + utcOffsetSeconds * 1000;
  const shifted = new Date(shiftedMs);
  shifted.setUTCMinutes(0, 0, 0);
  return shifted.getTime() - utcOffsetSeconds * 1000;
}

export function findHourlyStartIndex(
  times: string[],
  now: Date,
  utcOffsetSeconds: number,
): number {
  const threshold = startOfLocationHourMs(now, utcOffsetSeconds);
  for (let i = 0; i < times.length; i++) {
    const t = parseWallTimeMs(times[i], utcOffsetSeconds);
    if (!Number.isNaN(t) && t >= threshold) return i;
  }
  return times.length;
}

export function sliceHourlyFromNow<T>(args: {
  times: string[];
  values: T[];
  now: Date;
  utcOffsetSeconds: number;
  count?: number;
}): T[] {
  const count = args.count ?? 12;
  const start = findHourlyStartIndex(args.times, args.now, args.utcOffsetSeconds);
  return args.values.slice(start, start + count);
}
