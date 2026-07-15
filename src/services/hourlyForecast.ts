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
