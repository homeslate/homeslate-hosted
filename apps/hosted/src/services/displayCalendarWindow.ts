/** Past days included when serving display-calendar (week/month widgets need earlier days). */
export const DISPLAY_CALENDAR_DAYS_BACK_DEFAULT = 42;

export function displayCalendarWindow(
  daysAhead: number,
  daysBack: number,
  now: Date = new Date()
): { timeMin: Date; timeMax: Date } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const timeMin = new Date(startOfToday.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const timeMax = new Date(startOfToday.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return { timeMin, timeMax };
}
