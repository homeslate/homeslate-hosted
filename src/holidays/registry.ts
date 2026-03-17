export type HolidayId =
  | 'new-years-day'
  | 'valentines-day'
  | 'st-patricks-day'
  | 'independence-day'
  | 'halloween'
  | 'thanksgiving'
  | 'christmas'
  | 'new-years-eve';

export type HolidayStyleVariant =
  | 'newYearsDay'
  | 'valentines'
  | 'stPatricks'
  | 'independence'
  | 'halloween'
  | 'thanksgiving'
  | 'christmas'
  | 'newYearsEve';

export interface HolidayDefinition {
  id: HolidayId;
  label: string;
  bannerText: string;
  symbol: string;
  symbolCount: number;
  styleVariant: HolidayStyleVariant;
  isActive: (date: Date) => boolean;
}

function isMonthDay(date: Date, month: number, dayOfMonth: number): boolean {
  return date.getMonth() === month && date.getDate() === dayOfMonth;
}

function isThanksgiving(date: Date): boolean {
  // US Thanksgiving: fourth Thursday in November (22nd-28th)
  return (
    date.getMonth() === 10 &&
    date.getDay() === 4 &&
    date.getDate() >= 22 &&
    date.getDate() <= 28
  );
}

export const HOLIDAY_DEFINITIONS: HolidayDefinition[] = [
  {
    id: 'new-years-day',
    label: "New Year's Day",
    bannerText: 'Happy New Year',
    symbol: '\u2736',
    symbolCount: 16,
    styleVariant: 'newYearsDay',
    isActive: (date) => isMonthDay(date, 0, 1),
  },
  {
    id: 'valentines-day',
    label: "Valentine's Day",
    bannerText: "Happy Valentine's Day",
    symbol: '\u2665',
    symbolCount: 16,
    styleVariant: 'valentines',
    isActive: (date) => isMonthDay(date, 1, 14),
  },
  {
    id: 'st-patricks-day',
    label: "St. Patrick's Day",
    bannerText: "Happy St. Patrick's Day",
    symbol: '\u2618',
    symbolCount: 14,
    styleVariant: 'stPatricks',
    isActive: (date) => isMonthDay(date, 2, 17),
  },
  {
    id: 'independence-day',
    label: 'Independence Day',
    bannerText: 'Happy Fourth of July',
    symbol: '\u2605',
    symbolCount: 18,
    styleVariant: 'independence',
    isActive: (date) => isMonthDay(date, 6, 4),
  },
  {
    id: 'halloween',
    label: 'Halloween',
    bannerText: 'Happy Halloween',
    symbol: '\u2727',
    symbolCount: 16,
    styleVariant: 'halloween',
    isActive: (date) => isMonthDay(date, 9, 31),
  },
  {
    id: 'thanksgiving',
    label: 'Thanksgiving',
    bannerText: 'Happy Thanksgiving',
    symbol: '\u273F',
    symbolCount: 14,
    styleVariant: 'thanksgiving',
    isActive: isThanksgiving,
  },
  {
    id: 'christmas',
    label: 'Christmas',
    bannerText: 'Merry Christmas',
    symbol: '\u2744',
    symbolCount: 18,
    styleVariant: 'christmas',
    isActive: (date) => isMonthDay(date, 11, 25),
  },
  {
    id: 'new-years-eve',
    label: "New Year's Eve",
    bannerText: "New Year's Eve",
    symbol: '\u2736',
    symbolCount: 16,
    styleVariant: 'newYearsEve',
    isActive: (date) => isMonthDay(date, 11, 31),
  },
];

export const HOLIDAY_PREVIEW_OPTIONS = HOLIDAY_DEFINITIONS.map((holiday) => ({
  value: holiday.id,
  label: holiday.label,
}));

export function getHolidayById(id: HolidayId): HolidayDefinition | null {
  return HOLIDAY_DEFINITIONS.find((holiday) => holiday.id === id) ?? null;
}

export function getActiveHoliday(now: Date): HolidayDefinition | null {
  return HOLIDAY_DEFINITIONS.find((holiday) => holiday.isActive(now)) ?? null;
}
