import { lazy } from 'react';
import { registerWidget } from './registry';
import type { WidgetRegistryEntry } from './types';
import type { ClockConfig } from './widgets/ClockWidget';
import type { CalendarConfig } from './widgets/CalendarWidget';
import type { GoogleCalendarConfig } from './widgets/GoogleCalendarWidget';
import type { GoogleCalendarMonthConfig } from './widgets/GoogleCalendarMonthWidget';
import type { GoogleCalendarDayConfig } from './widgets/GoogleCalendarDayWidget';
import type { PhotoConfig } from './widgets/PhotoWidget';
import type { GooglePhotoCollageConfig } from './widgets/GooglePhotoCollageWidget';
import type { WeatherConfig } from './widgets/WeatherWidget';
import type { NewsConfig } from './widgets/NewsWidget';
import type { StocksConfig } from './widgets/StocksWidget';
import type { WeekCalendarConfig } from './widgets/WeekCalendarWidget';
import type { TodoConfig } from './widgets/TodoWidget';
import type { SportsConfig } from './widgets/SportsWidget';
import type { AlarmsConfig } from './widgets/AlarmsWidget';
import type { TimersConfig } from './widgets/TimersWidget';
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
  IconHourglass,
} from '@tabler/icons-react';

// Lazy-load widget components so each widget's bundle is only fetched when
// that widget type is first rendered on screen.
const ClockWidget = lazy(() => import('./widgets/ClockWidget').then((m) => ({ default: m.ClockWidget })));
const ClockWidgetSettings = lazy(() => import('./widgets/ClockWidget').then((m) => ({ default: m.ClockWidgetSettings })));

const CalendarWidget = lazy(() => import('./widgets/CalendarWidget').then((m) => ({ default: m.CalendarWidget })));
const CalendarWidgetSettings = lazy(() => import('./widgets/CalendarWidget').then((m) => ({ default: m.CalendarWidgetSettings })));

const GoogleCalendarWidget = lazy(() => import('./widgets/GoogleCalendarWidget').then((m) => ({ default: m.GoogleCalendarWidget })));
const GoogleCalendarWidgetSettings = lazy(() => import('./widgets/GoogleCalendarWidget').then((m) => ({ default: m.GoogleCalendarWidgetSettings })));

const GoogleCalendarMonthWidget = lazy(() => import('./widgets/GoogleCalendarMonthWidget').then((m) => ({ default: m.GoogleCalendarMonthWidget })));
const GoogleCalendarMonthWidgetSettings = lazy(() => import('./widgets/GoogleCalendarMonthWidget').then((m) => ({ default: m.GoogleCalendarMonthWidgetSettings })));

const GoogleCalendarDayWidget = lazy(() => import('./widgets/GoogleCalendarDayWidget').then((m) => ({ default: m.GoogleCalendarDayWidget })));
const GoogleCalendarDayWidgetSettings = lazy(() => import('./widgets/GoogleCalendarDayWidget').then((m) => ({ default: m.GoogleCalendarDayWidgetSettings })));

const PhotoWidget = lazy(() => import('./widgets/PhotoWidget').then((m) => ({ default: m.PhotoWidget })));
const PhotoWidgetSettings = lazy(() => import('./widgets/PhotoWidget').then((m) => ({ default: m.PhotoWidgetSettings })));

const GooglePhotoCollageWidget = lazy(() => import('./widgets/GooglePhotoCollageWidget').then((m) => ({ default: m.GooglePhotoCollageWidget })));
const GooglePhotoCollageWidgetSettings = lazy(() => import('./widgets/GooglePhotoCollageWidget').then((m) => ({ default: m.GooglePhotoCollageWidgetSettings })));

const WeatherWidget = lazy(() => import('./widgets/WeatherWidget').then((m) => ({ default: m.WeatherWidget })));
const WeatherWidgetSettings = lazy(() => import('./widgets/WeatherWidget').then((m) => ({ default: m.WeatherWidgetSettings })));

const NewsWidget = lazy(() => import('./widgets/NewsWidget').then((m) => ({ default: m.NewsWidget })));
const NewsWidgetSettings = lazy(() => import('./widgets/NewsWidget').then((m) => ({ default: m.NewsWidgetSettings })));

const StocksWidget = lazy(() => import('./widgets/StocksWidget').then((m) => ({ default: m.StocksWidget })));
const StocksWidgetSettings = lazy(() => import('./widgets/StocksWidget').then((m) => ({ default: m.StocksWidgetSettings })));

const WeekCalendarWidget = lazy(() => import('./widgets/WeekCalendarWidget').then((m) => ({ default: m.WeekCalendarWidget })));
const WeekCalendarWidgetSettings = lazy(() => import('./widgets/WeekCalendarWidget').then((m) => ({ default: m.WeekCalendarWidgetSettings })));

const TodoWidget = lazy(() => import('./widgets/TodoWidget').then((m) => ({ default: m.TodoWidget })));
const TodoWidgetSettings = lazy(() => import('./widgets/TodoWidget').then((m) => ({ default: m.TodoWidgetSettings })));

const SportsWidget = lazy(() => import('./widgets/SportsWidget').then((m) => ({ default: m.SportsWidget })));
const SportsWidgetSettings = lazy(() => import('./widgets/SportsWidget').then((m) => ({ default: m.SportsWidgetSettings })));

const AlarmsWidget = lazy(() => import('./widgets/AlarmsWidget').then((m) => ({ default: m.AlarmsWidget })));
const AlarmsWidgetSettings = lazy(() => import('./widgets/AlarmsWidget').then((m) => ({ default: m.AlarmsWidgetSettings })));

const TimersWidget = lazy(() => import('./widgets/TimersWidget').then((m) => ({ default: m.TimersWidget })));
const TimersWidgetSettings = lazy(() => import('./widgets/TimersWidget').then((m) => ({ default: m.TimersWidgetSettings })));

 
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
registerWidget(clockEntry);

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
registerWidget(calendarEntry);

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
registerWidget(googleCalendarEntry);

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
registerWidget(googleCalendarMonthEntry);

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
registerWidget(googleCalendarDayEntry);

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
registerWidget(photoEntry);



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
registerWidget(googlePhotoCollageEntry);

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
registerWidget(weatherEntry);

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
registerWidget(newsEntry);

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
registerWidget(stocksEntry);

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
registerWidget(weekCalendarEntry);

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
registerWidget(todoEntry);

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
registerWidget(sportsEntry);

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
registerWidget(alarmsEntry);

// Timers Widget
const timersEntry: WidgetRegistryEntry<TimersConfig> = {
  type: 'timers',
  name: 'Timers',
  description: 'Countdown timers with shared display alerts',
  icon: IconHourglass,
  component: TimersWidget,
  settingsComponent: TimersWidgetSettings,
  defaultConfig: {
    presets: [],
    transparentBackground: false,
  },
  defaultLayout: {
    w: 3,
    h: 3,
    minW: 2,
    minH: 2,
  },
};
registerWidget(timersEntry);

