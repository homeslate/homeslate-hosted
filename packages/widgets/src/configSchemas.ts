import { registerWidgetConfigSchema } from '@homeslate/schema';
import { z } from 'zod';

const textAlign = z.enum(['left', 'center', 'right']);

export const clockConfigSchema = z.object({
  showSeconds: z.boolean().optional(),
  showDate: z.boolean().optional(),
  use24Hour: z.boolean().optional(),
  timezone: z.string().optional(),
  transparentBackground: z.boolean().optional(),
  textAlign: textAlign.optional(),
});

export const calendarConfigSchema = z.object({
  icalUrl: z.string().optional(),
  showWeekNumbers: z.boolean().optional(),
  maxEvents: z.number().optional(),
  daysAhead: z.number().optional(),
  showCalendar: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const googleCalendarConfigSchema = z.object({
  clientId: z.string().optional(),
  selectedCalendarIds: z.array(z.string()).optional(),
  maxEvents: z.number().optional(),
  daysAhead: z.number().optional(),
  showCalendar: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const googleCalendarMonthConfigSchema = z.object({
  selectedCalendarIds: z.array(z.string()).optional(),
  daysAhead: z.number().optional(),
  transparentBackground: z.boolean().optional(),
});

export const googleCalendarDayConfigSchema = z.object({
  selectedCalendarIds: z.array(z.string()).optional(),
  maxEvents: z.number().optional(),
  daysAhead: z.number().optional(),
  transparentBackground: z.boolean().optional(),
});

export const weekCalendarConfigSchema = z.object({
  selectedCalendarIds: z.array(z.string()).optional(),
  viewMode: z.enum(['calendar-week', 'rolling-7']).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
  startHour: z.number().optional(),
  endHour: z.number().optional(),
  transparentBackground: z.boolean().optional(),
});

const urlPhoto = z.object({ type: z.literal('url'), url: z.string(), caption: z.string().optional() });
const storedPhoto = z.object({
  type: z.literal('stored'),
  key: z.string(),
  filename: z.string(),
  caption: z.string().optional(),
  previewUrl: z.string().optional(),
});
const photo = z.union([urlPhoto, storedPhoto]);

export const photoConfigSchema = z.object({
  photos: z.array(photo).optional(),
  interval: z.number().optional(),
  transition: z.enum(['fade', 'slide', 'none']).optional(),
  showCaption: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const googlePhotoCollageConfigSchema = z.object({
  rotationInterval: z.number().optional(),
  transparentBackground: z.boolean().optional(),
  photos: z.array(photo).optional(),
});

export const weatherConfigSchema = z.object({
  location: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  units: z.enum(['imperial', 'metric']).optional(),
  showForecast: z.boolean().optional(),
  forecastDays: z.number().optional(),
  transparentBackground: z.boolean().optional(),
  showAirQuality: z.boolean().optional(),
  textAlign: textAlign.optional(),
});

export const newsConfigSchema = z.object({
  feedUrls: z.array(z.string()).optional(),
  maxItems: z.number().optional(),
  showSource: z.boolean().optional(),
  showDescription: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const stocksConfigSchema = z.object({
  symbols: z.array(z.string()).optional(),
  apiKey: z.string().optional(),
  showChange: z.boolean().optional(),
  showDayRange: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const todoConfigSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        checked: z.boolean(),
      })
    )
    .optional(),
  hideCompleted: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const sportsConfigSchema = z.object({
  leagueId: z.string().optional(),
  favoriteTeamIds: z.array(z.string()).optional(),
  showAllGames: z.boolean().optional(),
  showCurrentGames: z.boolean().optional(),
  transparentBackground: z.boolean().optional(),
});

export const alarmsConfigSchema = z.object({
  transparentBackground: z.boolean().optional(),
});

export const timersConfigSchema = z.object({
  presets: z.array(z.unknown()).optional(),
  transparentBackground: z.boolean().optional(),
});

export const BUILTIN_WIDGET_CONFIG_SCHEMAS: Record<string, z.ZodType> = {
  clock: clockConfigSchema,
  calendar: calendarConfigSchema,
  'google-calendar': googleCalendarConfigSchema,
  'google-calendar-month': googleCalendarMonthConfigSchema,
  'google-calendar-day': googleCalendarDayConfigSchema,
  photo: photoConfigSchema,
  'google-photo-collage': googlePhotoCollageConfigSchema,
  weather: weatherConfigSchema,
  news: newsConfigSchema,
  stocks: stocksConfigSchema,
  'week-calendar': weekCalendarConfigSchema,
  todo: todoConfigSchema,
  sports: sportsConfigSchema,
  alarms: alarmsConfigSchema,
  timers: timersConfigSchema,
};

export function registerBuiltInWidgetConfigSchemas(): void {
  for (const [type, schema] of Object.entries(BUILTIN_WIDGET_CONFIG_SCHEMAS)) {
    registerWidgetConfigSchema(type, schema);
  }
}
