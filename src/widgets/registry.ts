import { lazy } from 'react';
import type { WidgetRegistryEntry, WidgetConfig } from '../types/widget';
import type { ClockConfig } from './ClockWidget';
import type { CalendarConfig } from './CalendarWidget';
import type { GoogleCalendarConfig } from './GoogleCalendarWidget';
import type { GoogleCalendarMonthConfig } from './GoogleCalendarMonthWidget';
import type { GoogleCalendarDayConfig } from './GoogleCalendarDayWidget';
import type { PhotoConfig } from './PhotoWidget';
import type { GooglePhotoCollageConfig } from './GooglePhotoCollageWidget';
import type { WeatherConfig } from './WeatherWidget';
import type { NewsConfig } from './NewsWidget';
import type { StocksConfig } from './StocksWidget';
import type { WeekCalendarConfig } from './WeekCalendarWidget';
import type { TodoConfig } from './TodoWidget';
import type { SportsConfig } from './SportsWidget';
import type { AlarmsConfig } from './AlarmsWidget';
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
  IconLayoutGrid,
  IconCheckbox,
  IconTrophy,
  IconAlarm,
} from '@tabler/icons-react';

// Lazy-load widget components so each widget's bundle is only fetched when
// that widget type is first rendered on screen.
const ClockWidget = lazy(() => import('./ClockWidget').then((m) => ({ default: m.ClockWidget })));
const ClockWidgetSettings = lazy(() => import('./ClockWidget').then((m) => ({ default: m.ClockWidgetSettings })));

const CalendarWidget = lazy(() => import('./CalendarWidget').then((m) => ({ default: m.CalendarWidget })));
const CalendarWidgetSettings = lazy(() => import('./CalendarWidget').then((m) => ({ default: m.CalendarWidgetSettings })));

const GoogleCalendarWidget = lazy(() => import('./GoogleCalendarWidget').then((m) => ({ default: m.GoogleCalendarWidget })));
const GoogleCalendarWidgetSettings = lazy(() => import('./GoogleCalendarWidget').then((m) => ({ default: m.GoogleCalendarWidgetSettings })));

const GoogleCalendarMonthWidget = lazy(() => import('./GoogleCalendarMonthWidget').then((m) => ({ default: m.GoogleCalendarMonthWidget })));
const GoogleCalendarMonthWidgetSettings = lazy(() => import('./GoogleCalendarMonthWidget').then((m) => ({ default: m.GoogleCalendarMonthWidgetSettings })));

const GoogleCalendarDayWidget = lazy(() => import('./GoogleCalendarDayWidget').then((m) => ({ default: m.GoogleCalendarDayWidget })));
const GoogleCalendarDayWidgetSettings = lazy(() => import('./GoogleCalendarDayWidget').then((m) => ({ default: m.GoogleCalendarDayWidgetSettings })));

const PhotoWidget = lazy(() => import('./PhotoWidget').then((m) => ({ default: m.PhotoWidget })));
const PhotoWidgetSettings = lazy(() => import('./PhotoWidget').then((m) => ({ default: m.PhotoWidgetSettings })));

const GooglePhotoCollageWidget = lazy(() => import('./GooglePhotoCollageWidget').then((m) => ({ default: m.GooglePhotoCollageWidget })));
const GooglePhotoCollageWidgetSettings = lazy(() => import('./GooglePhotoCollageWidget').then((m) => ({ default: m.GooglePhotoCollageWidgetSettings })));

const WeatherWidget = lazy(() => import('./WeatherWidget').then((m) => ({ default: m.WeatherWidget })));
const WeatherWidgetSettings = lazy(() => import('./WeatherWidget').then((m) => ({ default: m.WeatherWidgetSettings })));

const NewsWidget = lazy(() => import('./NewsWidget').then((m) => ({ default: m.NewsWidget })));
const NewsWidgetSettings = lazy(() => import('./NewsWidget').then((m) => ({ default: m.NewsWidgetSettings })));

const StocksWidget = lazy(() => import('./StocksWidget').then((m) => ({ default: m.StocksWidget })));
const StocksWidgetSettings = lazy(() => import('./StocksWidget').then((m) => ({ default: m.StocksWidgetSettings })));

const WeekCalendarWidget = lazy(() => import('./WeekCalendarWidget').then((m) => ({ default: m.WeekCalendarWidget })));
const WeekCalendarWidgetSettings = lazy(() => import('./WeekCalendarWidget').then((m) => ({ default: m.WeekCalendarWidgetSettings })));

const TodoWidget = lazy(() => import('./TodoWidget').then((m) => ({ default: m.TodoWidget })));
const TodoWidgetSettings = lazy(() => import('./TodoWidget').then((m) => ({ default: m.TodoWidgetSettings })));

const SportsWidget = lazy(() => import('./SportsWidget').then((m) => ({ default: m.SportsWidget })));
const SportsWidgetSettings = lazy(() => import('./SportsWidget').then((m) => ({ default: m.SportsWidgetSettings })));

const AlarmsWidget = lazy(() => import('./AlarmsWidget').then((m) => ({ default: m.AlarmsWidget })));
const AlarmsWidgetSettings = lazy(() => import('./AlarmsWidget').then((m) => ({ default: m.AlarmsWidgetSettings })));

 
const widgetRegistry = new Map<string, WidgetRegistryEntry<WidgetConfig>>();

function setWidgetEntry<T extends WidgetConfig>(type: string, entry: WidgetRegistryEntry<T>): void {
  widgetRegistry.set(type, entry as unknown as WidgetRegistryEntry<WidgetConfig>);
}

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
    transparentBackground: false,
    textAlign: 'center',
  },
  defaultLayout: {
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
  },
};
setWidgetEntry('clock', clockEntry);

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
    transparentBackground: false,
  },
  defaultLayout: {
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
};
setWidgetEntry('calendar', calendarEntry);

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
    transparentBackground: false,
  },
  defaultLayout: {
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
};
setWidgetEntry('google-calendar', googleCalendarEntry);

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
    transparentBackground: false,
  },
  defaultLayout: {
    w: 4,
    h: 5,
    minW: 3,
    minH: 4,
  },
};
setWidgetEntry('google-calendar-month', googleCalendarMonthEntry);

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
    transparentBackground: false,
  },
  defaultLayout: {
    w: 3,
    h: 4,
    minW: 2,
    minH: 3,
  },
};
setWidgetEntry('google-calendar-day', googleCalendarDayEntry);

// Photo Widget (combined: URL photos, Google Photos, and device uploads)
const photoEntry: WidgetRegistryEntry<PhotoConfig> = {
  type: 'photo',
  name: 'Photos',
  description: 'Slideshow with URL, Google Photos, or device uploads',
  icon: IconPhoto,
  component: PhotoWidget,
  settingsComponent: PhotoWidgetSettings,
  defaultConfig: {
    photos: [],
    interval: 10,
    transition: 'fade',
    showCaption: true,
    transparentBackground: false,
  },
  defaultLayout: {
    w: 4,
    h: 3,
    minW: 2,
    minH: 2,
  },
};
setWidgetEntry('photo', photoEntry);



// Google Photo Collage Widget
const googlePhotoCollageEntry: WidgetRegistryEntry<GooglePhotoCollageConfig> = {
  type: 'google-photo-collage',
  name: 'Photo Collage',
  description: 'Masonry collage from URL, device uploads, or Google Photos — rotates one photo at a time',
  icon: IconLayoutGrid,
  component: GooglePhotoCollageWidget,
  settingsComponent: GooglePhotoCollageWidgetSettings,
  defaultConfig: {
    rotationInterval: 10,
    transparentBackground: false,
    photos: [],
  },
  defaultLayout: {
    w: 5,
    h: 4,
    minW: 3,
    minH: 3,
  },
};
setWidgetEntry('google-photo-collage', googlePhotoCollageEntry);

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
    transparentBackground: false,
    showAirQuality: false,
    textAlign: 'left',
  },
  defaultLayout: {
    w: 3,
    h: 3,
    minW: 2,
    minH: 2,
  },
};
setWidgetEntry('weather', weatherEntry);

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
    transparentBackground: false,
  },
  defaultLayout: {
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
};
setWidgetEntry('news', newsEntry);

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
    transparentBackground: false,
  },
  defaultLayout: {
    w: 3,
    h: 4,
    minW: 2,
    minH: 3,
  },
};
setWidgetEntry('stocks', stocksEntry);

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
    transparentBackground: false,
  },
  defaultLayout: {
    w: 7,
    h: 6,
    minW: 5,
    minH: 4,
  },
};
setWidgetEntry('week-calendar', weekCalendarEntry);

// To-Do List Widget
const todoEntry: WidgetRegistryEntry<TodoConfig> = {
  type: 'todo',
  name: 'To-Do List',
  description: 'Interactive checklist — check items off in kiosk mode',
  icon: IconCheckbox,
  component: TodoWidget,
  settingsComponent: TodoWidgetSettings,
  defaultConfig: {
    items: [],
    hideCompleted: false,
    transparentBackground: false,
  },
  defaultLayout: {
    w: 3,
    h: 4,
    minW: 2,
    minH: 3,
  },
};
setWidgetEntry('todo', todoEntry);

// Sports Scores Widget
const sportsEntry: WidgetRegistryEntry<SportsConfig> = {
  type: 'sports',
  name: 'Sports Scores',
  description: 'Live scores and schedules via ESPN (NHL, NFL, NBA, MLB & more)',
  icon: IconTrophy,
  component: SportsWidget,
  settingsComponent: SportsWidgetSettings,
  defaultConfig: {
    leagueId: 'nhl',
    favoriteTeamIds: [],
    showAllGames: true,
    showCurrentGames: true,
    transparentBackground: false,
  },
  defaultLayout: {
    w: 3,
    h: 4,
    minW: 2,
    minH: 3,
  },
};
setWidgetEntry('sports', sportsEntry);

// Alarms Widget
const alarmsEntry: WidgetRegistryEntry<AlarmsConfig> = {
  type: 'alarms',
  name: 'Alarms',
  description: 'View and manage recurring display alarms',
  icon: IconAlarm,
  component: AlarmsWidget,
  settingsComponent: AlarmsWidgetSettings,
  defaultConfig: {
    transparentBackground: false,
  },
  defaultLayout: {
    w: 3,
    h: 3,
    minW: 2,
    minH: 2,
  },
};
setWidgetEntry('alarms', alarmsEntry);

 
export const getWidgetTypes = (): WidgetRegistryEntry<WidgetConfig>[] => {
  return Array.from(widgetRegistry.values());
};

 
export const getWidgetByType = (type: string): WidgetRegistryEntry<WidgetConfig> | undefined => {
  return widgetRegistry.get(type);
};

export const registerWidget = <T extends WidgetConfig>(entry: WidgetRegistryEntry<T>): void => {
  setWidgetEntry(entry.type, entry);
};
