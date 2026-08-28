import {
  validateDisplayDocument,
  migrateDisplayDocument,
  type DisplayDocument,
  type DisplayValidationError,
  type DisplayValidationResult,
  type View,
} from '@homeslate/schema';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLegacyPutBody(raw: unknown): DisplayValidationError[] {
  if (!isPlainObject(raw) || raw.schemaVersion === 1 || !Array.isArray(raw.layouts)) {
    return [];
  }
  const errors: DisplayValidationError[] = [];
  raw.layouts.forEach((layout, layoutIndex) => {
    if (!isPlainObject(layout) || !Array.isArray(layout.widgets)) return;
    layout.widgets.forEach((widget, widgetIndex) => {
      const basePath = `layouts.${layoutIndex}.widgets.${widgetIndex}`;
      if (!isPlainObject(widget)) {
        errors.push({ path: basePath, message: 'Invalid widget' });
        return;
      }
      if (typeof widget.type !== 'string' || widget.type.length === 0) {
        errors.push({ path: `${basePath}.type`, message: 'Required' });
      }
      if (!isPlainObject(widget.config)) {
        errors.push({ path: `${basePath}.config`, message: 'Required' });
      }
      const widgetLayout = widget.layout;
      if (!isPlainObject(widgetLayout)) {
        errors.push({ path: `${basePath}.layout`, message: 'Required' });
        return;
      }
      (['x', 'y', 'w', 'h'] as const).forEach((key) => {
        if (typeof widgetLayout[key] !== 'number') {
          errors.push({ path: `${basePath}.layout.${key}`, message: 'Required' });
        }
      });
    });
  });
  return errors;
}

function viewToLegacyLayout(view: View): Record<string, unknown> {
  const layout: Record<string, unknown> = {
    id: view.id,
    name: view.name,
    widgets: view.widgets,
    columns: view.columns,
    rowHeight: view.rowHeight,
  };
  if (view.icon !== undefined) layout.icon = view.icon;
  if (view.hidden !== undefined) layout.hidden = view.hidden;
  if (view.notes !== undefined) layout.notes = view.notes;
  if (view.background?.image !== undefined) layout.backgroundImage = view.background.image;
  if (view.background?.imageSize !== undefined) layout.backgroundImageSize = view.background.imageSize;
  if (view.background?.overlayOpacity !== undefined) {
    layout.backgroundOverlayOpacity = view.background.overlayOpacity;
  }
  if (view.background?.photos !== undefined) layout.backgroundPhotos = view.background.photos;
  if (view.background?.intervalSeconds !== undefined) {
    layout.backgroundInterval = view.background.intervalSeconds;
  }
  return layout;
}

export function toLegacyConfig(document: DisplayDocument): Record<string, unknown> {
  const legacy: Record<string, unknown> = {
    layouts: document.views.map(viewToLegacyLayout),
    activeLayoutId: document.activeViewId,
    rotationEnabled: document.rotation.enabled,
    rotationIntervalMs: document.rotation.intervalMs,
    themes: document.themes,
    activeThemeId: document.activeThemeId,
  };
  if (document.colorMode !== undefined) legacy.colorMode = document.colorMode;
  if (document.settings.stickyNotesEnabled !== undefined) {
    legacy.stickyNotesEnabled = document.settings.stickyNotesEnabled;
  }
  if (document.settings.voiceEnabled !== undefined) {
    legacy.voiceEnabled = document.settings.voiceEnabled;
  }
  if (document.settings.holidayEffectsEnabled !== undefined) {
    legacy.holidayEffectsEnabled = document.settings.holidayEffectsEnabled;
  }
  if (document.settings.holidayPreviewId !== undefined) {
    legacy.holidayPreviewId = document.settings.holidayPreviewId;
  }
  if (document.alarms !== undefined) legacy.alarms = document.alarms;
  return legacy;
}

export function writeStoredConfig(raw: unknown): DisplayValidationResult {
  const legacyErrors = validateLegacyPutBody(raw);
  if (legacyErrors.length > 0) {
    return { ok: false, errors: legacyErrors };
  }
  return validateDisplayDocument(raw);
}

export function readStoredConfig(raw: unknown): {
  document: DisplayDocument;
  legacy: Record<string, unknown>;
} {
  let document: DisplayDocument;
  try {
    document = migrateDisplayDocument(raw);
  } catch {
    document = migrateDisplayDocument({});
  }
  const validated = validateDisplayDocument(document);
  if (validated.ok) {
    return { document: validated.document, legacy: toLegacyConfig(validated.document) };
  }
  return { document, legacy: toLegacyConfig(document) };
}
