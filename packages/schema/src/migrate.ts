import type {
  AlarmDefinition,
  ColorMode,
  DisplayDocument,
  HolidayId,
  StickyNote,
  View,
  ViewBackground,
  WidgetInstance,
  WidgetLayout,
} from './types';

const DEFAULT_ROTATION_MS = 30000;
const DEFAULT_NAME = 'Homeslate';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function migrateLayout(raw: unknown): WidgetLayout {
  const o = isPlainObject(raw) ? raw : {};
  return {
    x: asNumber(o.x) ?? 0,
    y: asNumber(o.y) ?? 0,
    w: asNumber(o.w) ?? 1,
    h: asNumber(o.h) ?? 1,
    ...(asNumber(o.minW) !== undefined ? { minW: o.minW as number } : {}),
    ...(asNumber(o.minH) !== undefined ? { minH: o.minH as number } : {}),
    ...(asNumber(o.maxW) !== undefined ? { maxW: o.maxW as number } : {}),
    ...(asNumber(o.maxH) !== undefined ? { maxH: o.maxH as number } : {}),
  };
}

function migrateWidget(raw: unknown): WidgetInstance {
  const o = isPlainObject(raw) ? raw : {};
  const config = isPlainObject(o.config) ? o.config : {};
  return {
    id: asString(o.id) ?? '',
    type: asString(o.type) ?? 'unknown',
    title: asString(o.title) ?? '',
    config,
    layout: migrateLayout(o.layout),
  };
}

function migrateBackground(layout: Record<string, unknown>): ViewBackground | undefined {
  const photos = Array.isArray(layout.backgroundPhotos) ? layout.backgroundPhotos : undefined;
  const background: ViewBackground = {
    ...(asString(layout.backgroundImage) ? { image: layout.backgroundImage as string } : {}),
    ...(layout.backgroundImageSize === 'cover' ||
    layout.backgroundImageSize === 'contain' ||
    layout.backgroundImageSize === 'tile'
      ? { imageSize: layout.backgroundImageSize }
      : {}),
    ...(asNumber(layout.backgroundOverlayOpacity) !== undefined
      ? { overlayOpacity: layout.backgroundOverlayOpacity as number }
      : {}),
    ...(photos ? { photos } : {}),
    ...(asNumber(layout.backgroundInterval) !== undefined
      ? { intervalSeconds: layout.backgroundInterval as number }
      : {}),
  };
  return Object.keys(background).length > 0 ? background : undefined;
}

function migrateNotes(raw: unknown): StickyNote[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(isPlainObject).map((n) => ({
    id: asString(n.id) ?? '',
    text: asString(n.text) ?? '',
    x: asNumber(n.x) ?? 0,
    y: asNumber(n.y) ?? 0,
    color: asString(n.color) ?? 'yellow',
  }));
}

function migrateView(raw: unknown): View {
  const o = isPlainObject(raw) ? raw : {};
  const widgets = Array.isArray(o.widgets) ? o.widgets.map(migrateWidget) : [];
  const existingBackground = isPlainObject(o.background) ? o.background : undefined;
  const background = existingBackground
    ? {
        ...(asString(existingBackground.image) ? { image: existingBackground.image as string } : {}),
        ...(existingBackground.imageSize === 'cover' ||
        existingBackground.imageSize === 'contain' ||
        existingBackground.imageSize === 'tile'
          ? { imageSize: existingBackground.imageSize }
          : {}),
        ...(asNumber(existingBackground.overlayOpacity) !== undefined
          ? { overlayOpacity: existingBackground.overlayOpacity as number }
          : {}),
        ...(Array.isArray(existingBackground.photos) ? { photos: existingBackground.photos } : {}),
        ...(asNumber(existingBackground.intervalSeconds) !== undefined
          ? { intervalSeconds: existingBackground.intervalSeconds as number }
          : {}),
      }
    : migrateBackground(o);
  const notes = migrateNotes(o.notes);
  return {
    id: asString(o.id) ?? '',
    name: asString(o.name) ?? 'View',
    ...(asString(o.icon) ? { icon: o.icon as string } : {}),
    ...(asBoolean(o.hidden) !== undefined ? { hidden: o.hidden as boolean } : {}),
    columns: asNumber(o.columns) ?? 12,
    rowHeight: asNumber(o.rowHeight) ?? 80,
    widgets,
    ...(background && Object.keys(background).length > 0 ? { background } : {}),
    ...(notes ? { notes } : {}),
  };
}

function migrateAlarms(raw: unknown): AlarmDefinition[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(isPlainObject).map((a) => ({
    id: asString(a.id) ?? '',
    label: asString(a.label) ?? '',
    enabled: asBoolean(a.enabled) ?? true,
    time: asString(a.time) ?? '00:00',
    days: Array.isArray(a.days) ? a.days.filter((d): d is number => typeof d === 'number') : [],
    toneId:
      a.toneId === 'chime' || a.toneId === 'bell' || a.toneId === 'radar' ? a.toneId : 'chime',
  }));
}

export function migrateDisplayDocument(raw: unknown): DisplayDocument {
  if (!isPlainObject(raw)) {
    throw new TypeError('Display document must be a plain object');
  }

  if (raw.schemaVersion === 1 && Array.isArray(raw.views)) {
    const rotation = isPlainObject(raw.rotation) ? raw.rotation : {};
    const settings = isPlainObject(raw.settings) ? raw.settings : {};
    const v1ColorMode: ColorMode | undefined =
      raw.colorMode === 'light' || raw.colorMode === 'dark' ? raw.colorMode : undefined;
    const v1Holiday = asString(settings.holidayPreviewId) as HolidayId | undefined;
    const v1Alarms = migrateAlarms(raw.alarms);
    return {
      schemaVersion: 1,
      name: asString(raw.name) ?? DEFAULT_NAME,
      views: raw.views.map(migrateView),
      activeViewId: asString(raw.activeViewId) ?? null,
      rotation: {
        enabled: asBoolean(rotation.enabled) ?? false,
        intervalMs: asNumber(rotation.intervalMs) ?? DEFAULT_ROTATION_MS,
      },
      themes: Array.isArray(raw.themes) ? raw.themes : [],
      activeThemeId: asString(raw.activeThemeId) ?? null,
      ...(v1ColorMode ? { colorMode: v1ColorMode } : {}),
      settings: {
        ...(asBoolean(settings.stickyNotesEnabled) !== undefined
          ? { stickyNotesEnabled: settings.stickyNotesEnabled as boolean }
          : {}),
        ...(asBoolean(settings.voiceEnabled) !== undefined
          ? { voiceEnabled: settings.voiceEnabled as boolean }
          : {}),
        ...(asBoolean(settings.holidayEffectsEnabled) !== undefined
          ? { holidayEffectsEnabled: settings.holidayEffectsEnabled as boolean }
          : {}),
        ...(v1Holiday ? { holidayPreviewId: v1Holiday } : {}),
      },
      ...(v1Alarms ? { alarms: v1Alarms } : {}),
    };
  }

  const layouts = Array.isArray(raw.layouts) ? raw.layouts : [];
  const holidayPreviewId = asString(raw.holidayPreviewId) as HolidayId | undefined;
  const colorMode: ColorMode | undefined =
    raw.colorMode === 'light' || raw.colorMode === 'dark' ? raw.colorMode : undefined;

  const settings: DisplayDocument['settings'] = {
    ...(asBoolean(raw.stickyNotesEnabled) !== undefined
      ? { stickyNotesEnabled: raw.stickyNotesEnabled as boolean }
      : {}),
    ...(asBoolean(raw.voiceEnabled) !== undefined ? { voiceEnabled: raw.voiceEnabled as boolean } : {}),
    ...(asBoolean(raw.holidayEffectsEnabled) !== undefined
      ? { holidayEffectsEnabled: raw.holidayEffectsEnabled as boolean }
      : {}),
    ...(holidayPreviewId ? { holidayPreviewId } : {}),
  };

  const alarms = migrateAlarms(raw.alarms);

  return {
    schemaVersion: 1,
    name: asString(raw.name) ?? DEFAULT_NAME,
    views: layouts.map(migrateView),
    activeViewId: asString(raw.activeLayoutId) ?? asString(raw.activeViewId) ?? null,
    rotation: {
      enabled: asBoolean(raw.rotationEnabled) ?? false,
      intervalMs: asNumber(raw.rotationIntervalMs) ?? DEFAULT_ROTATION_MS,
    },
    themes: Array.isArray(raw.themes) ? raw.themes : [],
    activeThemeId: asString(raw.activeThemeId) ?? null,
    ...(colorMode ? { colorMode } : {}),
    settings,
    ...(alarms ? { alarms } : {}),
  };
}
