import type { WidgetRegistryEntry, WidgetConfig } from '../types/widget';
import { ClockWidget, ClockWidgetSettings, type ClockConfig } from './ClockWidget';
import { CalendarWidget, CalendarWidgetSettings, type CalendarConfig } from './CalendarWidget';
import { GoogleCalendarWidget, GoogleCalendarWidgetSettings, type GoogleCalendarConfig } from './GoogleCalendarWidget';
import { GoogleCalendarMonthWidget, GoogleCalendarMonthWidgetSettings, type GoogleCalendarMonthConfig } from './GoogleCalendarMonthWidget';
import { GoogleCalendarDayWidget, GoogleCalendarDayWidgetSettings, type GoogleCalendarDayConfig } from './GoogleCalendarDayWidget';
import { PhotoWidget, PhotoWidgetSettings, type PhotoConfig } from './PhotoWidget';
import { WeatherWidget, WeatherWidgetSettings, type WeatherConfig } from './WeatherWidget';
import { NewsWidget, NewsWidgetSettings, type NewsConfig } from './NewsWidget';
import { StocksWidget, StocksWidgetSettings, type StocksConfig } from './StocksWidget';
import { WeekCalendarWidget, WeekCalendarWidgetSettings, type WeekCalendarConfig } from './WeekCalendarWidget';
import {
  IconClock,
  IconCalendar,
  IconCalendarMonth,
  IconCalendarEvent,
  IconPhoto,
  IconCloudRain,
  IconNews,
  IconChartLine,
  IconBrandGoogle,
  IconCalendarWeek,
} from '@tabler/icons-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const widgetRegistry = new Map<string, WidgetRegistryEntry<any>>();

// Clock Widget
const clockEntry: WidgetRegistryEntry<ClockConfig> = {
  type: 'clock',
  name: 'Clock',
  description: 'Display current time and date',
  icon: IconClock,
  component: ClockWidget,
  settingsComponent: ClockWidgetSettings,
  defaultConfig: {
    showSeconds: true,
    showDate: true,
    use24Hour: false,
    timezone: 'local',
  },
  defaultLayout: {
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
  },
};
widgetRegistry.set('clock', clockEntry);

// Calendar Widget
const calendarEntry: WidgetRegistryEntry<CalendarConfig> = {
  type: 'calendar',
  name: 'Calendar',
  description: 'Display calendar and events from any iCal feed',
  icon: IconCalendar,
  component: CalendarWidget,
  settingsComponent: CalendarWidgetSettings,
  defaultConfig: {
    icalUrl: '',
    showWeekNumbers: false,
    maxEvents: 5,
    daysAhead: 30,
    showCalendar: true,
  },
  defaultLayout: {
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
};
widgetRegistry.set('calendar', calendarEntry);

// Google Calendar Widget (OAuth)
const googleCalendarEntry: WidgetRegistryEntry<GoogleCalendarConfig> = {
  type: 'google-calendar',
  name: 'Google Calendar',
  description: 'Display events from your Google Calendar with OAuth',
  icon: IconBrandGoogle,
  component: GoogleCalendarWidget,
  settingsComponent: GoogleCalendarWidgetSettings,
  defaultConfig: {
    clientId: '',
    selectedCalendarIds: [],
    maxEvents: 10,
    daysAhead: 30,
    showCalendar: true,
  },
  defaultLayout: {
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
};
widgetRegistry.set('google-calendar', googleCalendarEntry);

// Google Calendar Month Widget
const googleCalendarMonthEntry: WidgetRegistryEntry<GoogleCalendarMonthConfig> = {
  type: 'google-calendar-month',
  name: 'Google Calendar Month',
  description: 'Month calendar view with event indicators and day detail panel',
  icon: IconCalendarMonth,
  component: GoogleCalendarMonthWidget,
  settingsComponent: GoogleCalendarMonthWidgetSettings,
  defaultConfig: {
    selectedCalendarIds: [],
    daysAhead: 60,
  },
  defaultLayout: {
    w: 4,
    h: 5,
    minW: 3,
    minH: 4,
  },
};
widgetRegistry.set('google-calendar-month', googleCalendarMonthEntry);

// Google Calendar Day Widget
const googleCalendarDayEntry: WidgetRegistryEntry<GoogleCalendarDayConfig> = {
  type: 'google-calendar-day',
  name: 'Google Calendar Day',
  description: 'Upcoming events list grouped by day with add/edit/delete',
  icon: IconCalendarEvent,
  component: GoogleCalendarDayWidget,
  settingsComponent: GoogleCalendarDayWidgetSettings,
  defaultConfig: {
    selectedCalendarIds: [],
    maxEvents: 10,
    daysAhead: 30,
  },
  defaultLayout: {
    w: 3,
    h: 4,
    minW: 2,
    minH: 3,
  },
};
widgetRegistry.set('google-calendar-day', googleCalendarDayEntry);

// Photo Widget
const photoEntry: WidgetRegistryEntry<PhotoConfig> = {
  type: 'photo',
  name: 'Photos',
  description: 'Display a rotating slideshow of photos',
  icon: IconPhoto,
  component: PhotoWidget,
  settingsComponent: PhotoWidgetSettings,
  defaultConfig: {
    photos: [],
    interval: 10,
    transition: 'fade',
    showCaption: true,
  },
  defaultLayout: {
    w: 4,
    h: 3,
    minW: 2,
    minH: 2,
  },
};
widgetRegistry.set('photo', photoEntry);

// Weather Widget
const weatherEntry: WidgetRegistryEntry<WeatherConfig> = {
  type: 'weather',
  name: 'Weather',
  description: 'Display current weather and forecast',
  icon: IconCloudRain,
  component: WeatherWidget,
  settingsComponent: WeatherWidgetSettings,
  defaultConfig: {
    location: '',
    latitude: null,
    longitude: null,
    units: 'imperial',
    showForecast: true,
    forecastDays: 5,
  },
  defaultLayout: {
    w: 3,
    h: 3,
    minW: 2,
    minH: 2,
  },
};
widgetRegistry.set('weather', weatherEntry);

// News Widget
const newsEntry: WidgetRegistryEntry<NewsConfig> = {
  type: 'news',
  name: 'News',
  description: 'Display news from RSS feeds',
  icon: IconNews,
  component: NewsWidget,
  settingsComponent: NewsWidgetSettings,
  defaultConfig: {
    feedUrls: [],
    maxItems: 10,
    showSource: true,
    showDescription: false,
  },
  defaultLayout: {
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
};
widgetRegistry.set('news', newsEntry);

// Stocks Widget
const stocksEntry: WidgetRegistryEntry<StocksConfig> = {
  type: 'stocks',
  name: 'Stocks',
  description: 'Display stock market prices',
  icon: IconChartLine,
  component: StocksWidget,
  settingsComponent: StocksWidgetSettings,
  defaultConfig: {
    symbols: [],
    apiKey: '',
    showChange: true,
    showDayRange: false,
  },
  defaultLayout: {
    w: 3,
    h: 4,
    minW: 2,
    minH: 3,
  },
};
widgetRegistry.set('stocks', stocksEntry);

// Week Calendar Widget
const weekCalendarEntry: WidgetRegistryEntry<WeekCalendarConfig> = {
  type: 'week-calendar',
  name: 'Week Calendar',
  description: 'Google Calendar week view with timed events and current time indicator',
  icon: IconCalendarWeek,
  component: WeekCalendarWidget,
  settingsComponent: WeekCalendarWidgetSettings,
  defaultConfig: {
    selectedCalendarIds: [],
    viewMode: 'calendar-week',
    weekStartsOn: 0,
    startHour: 7,
    endHour: 21,
  },
  defaultLayout: {
    w: 7,
    h: 6,
    minW: 5,
    minH: 4,
  },
};
widgetRegistry.set('week-calendar', weekCalendarEntry);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getWidgetTypes = (): WidgetRegistryEntry<any>[] => {
  return Array.from(widgetRegistry.values());
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getWidgetByType = (type: string): WidgetRegistryEntry<any> | undefined => {
  return widgetRegistry.get(type);
};

export const registerWidget = <T extends WidgetConfig>(entry: WidgetRegistryEntry<T>): void => {
  widgetRegistry.set(entry.type, entry);
};

