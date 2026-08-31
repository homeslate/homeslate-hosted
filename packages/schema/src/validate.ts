import { z } from 'zod';
import { migrateDisplayDocument } from './migrate';
import { validateThemeDocument } from './themeDocumentValidation';
import type { DisplayDocument } from './types';

export type DisplayValidationError = { path: string; message: string };

export type DisplayValidationResult =
  | { ok: true; document: DisplayDocument }
  | { ok: false; errors: DisplayValidationError[] };

const widgetConfigSchemas = new Map<string, z.ZodType>();

export function registerWidgetConfigSchema(type: string, schema: z.ZodType): void {
  widgetConfigSchemas.set(type, schema);
}

export function clearWidgetConfigSchemas(): void {
  widgetConfigSchemas.clear();
}

const holidayIdSchema = z.enum([
  'new-years-day',
  'valentines-day',
  'st-patricks-day',
  'independence-day',
  'halloween',
  'thanksgiving',
  'christmas',
  'new-years-eve',
]);

const widgetLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  minW: z.number().optional(),
  minH: z.number().optional(),
  maxW: z.number().optional(),
  maxH: z.number().optional(),
});

const widgetInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string(),
  config: z.record(z.string(), z.unknown()),
  layout: widgetLayoutSchema,
});

const viewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional(),
  hidden: z.boolean().optional(),
  columns: z.number(),
  rowHeight: z.number(),
  widgets: z.array(widgetInstanceSchema),
  background: z
    .object({
      image: z.string().optional(),
      imageSize: z.enum(['cover', 'contain', 'tile']).optional(),
      overlayOpacity: z.number().optional(),
      photos: z.array(z.unknown()).optional(),
      intervalSeconds: z.number().optional(),
    })
    .optional(),
  notes: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string(),
        x: z.number(),
        y: z.number(),
        color: z.string().min(1),
      })
    )
    .optional(),
});

const displayDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1),
  views: z.array(viewSchema),
  activeViewId: z.string().nullable(),
  rotation: z.object({
    enabled: z.boolean(),
    intervalMs: z.number().int().positive(),
  }),
  themes: z.array(z.unknown()),
  activeThemeId: z.string().nullable(),
  colorMode: z.enum(['light', 'dark']).optional(),
  settings: z.object({
    stickyNotesEnabled: z.boolean().optional(),
    voiceEnabled: z.boolean().optional(),
    holidayEffectsEnabled: z.boolean().optional(),
    holidayPreviewId: holidayIdSchema.optional(),
  }),
  alarms: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string(),
        enabled: z.boolean(),
        time: z.string(),
        days: z.array(z.number().int().min(0).max(6)),
        toneId: z.enum(['chime', 'bell', 'radar']),
      })
    )
    .optional(),
});

function flattenZod(error: z.ZodError): DisplayValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '$',
    message: issue.message,
  }));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateDisplayDocument(raw: unknown): DisplayValidationResult {
  let migrated: DisplayDocument;
  try {
    migrated = migrateDisplayDocument(raw);
  } catch (err) {
    return {
      ok: false,
      errors: [{ path: '$', message: err instanceof Error ? err.message : 'Invalid document' }],
    };
  }

  if (isPlainObject(raw) && 'schemaVersion' in raw && raw.schemaVersion !== 1) {
    return {
      ok: false,
      errors: [{ path: 'schemaVersion', message: 'Unsupported schema version' }],
    };
  }

  const validationTarget = isPlainObject(raw) && raw.schemaVersion === 1 ? raw : migrated;

  const parsed = displayDocumentSchema.safeParse(validationTarget);
  if (!parsed.success) {
    return { ok: false, errors: flattenZod(parsed.error) };
  }

  const extra: DisplayValidationError[] = [];
  parsed.data.views.forEach((view, viewIndex) => {
    view.widgets.forEach((widget, widgetIndex) => {
      const configSchema = widgetConfigSchemas.get(widget.type);
      if (!configSchema) return;
      const configParsed = configSchema.safeParse(widget.config);
      if (!configParsed.success) {
        extra.push(
          ...flattenZod(configParsed.error).map((e) => ({
            path: `views.${viewIndex}.widgets.${widgetIndex}.config.${e.path}`.replace(/\.$/, ''),
            message: e.message,
          }))
        );
      }
    });
  });

  parsed.data.themes.forEach((theme, index) => {
    const validation = validateThemeDocument(theme);
    if (validation.ok) return;
    extra.push(
      ...validation.issues.map((issue) => ({
        path: `themes.${index}.${issue.path}`,
        message: issue.message,
      }))
    );
  });

  if (typeof parsed.data.activeThemeId === 'string') {
    const ids = parsed.data.themes
      .map((document) =>
        typeof document === 'object' && document && 'id' in document
          ? (document as { id?: unknown }).id
          : undefined
      )
      .filter((id): id is string => typeof id === 'string');
    if (!ids.includes(parsed.data.activeThemeId)) {
      extra.push({
        path: 'activeThemeId',
        message: 'activeThemeId must exist in themes',
      });
    }
  }

  if (extra.length > 0) {
    return { ok: false, errors: extra };
  }

  return { ok: true, document: migrated };
}
