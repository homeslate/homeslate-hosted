import { afterEach, describe, expect, it } from 'vitest';
import {
  clearWidgetConfigSchemas,
  validateDisplayDocument,
} from '@homeslate/schema';
import {
  BUILTIN_WIDGET_CONFIG_SCHEMAS,
  registerBuiltInWidgetConfigSchemas,
} from './configSchemas';

afterEach(() => {
  clearWidgetConfigSchemas();
});

const baseDoc = {
  schemaVersion: 1 as const,
  name: 'Kitchen',
  views: [
    {
      id: 'v1',
      name: 'Main',
      columns: 12,
      rowHeight: 80,
      widgets: [] as Array<{
        id: string;
        type: string;
        title: string;
        config: Record<string, unknown>;
        layout: { x: number; y: number; w: number; h: number };
      }>,
    },
  ],
  activeViewId: 'v1',
  rotation: { enabled: false, intervalMs: 30000 },
  themes: [],
  activeThemeId: null,
  settings: {},
};

function docWith(type: string, config: Record<string, unknown>) {
  return {
    ...baseDoc,
    views: [
      {
        ...baseDoc.views[0],
        widgets: [
          {
            id: 'w1',
            type,
            title: type,
            config,
            layout: { x: 0, y: 0, w: 2, h: 2 },
          },
        ],
      },
    ],
  };
}

describe('built-in widget config schemas', () => {
  it('registers every built-in type', () => {
    expect(Object.keys(BUILTIN_WIDGET_CONFIG_SCHEMAS).sort()).toEqual(
      [
        'alarms',
        'calendar',
        'clock',
        'google-calendar',
        'google-calendar-day',
        'google-calendar-month',
        'google-photo-collage',
        'news',
        'photo',
        'sports',
        'stocks',
        'timers',
        'todo',
        'weather',
        'week-calendar',
      ].sort()
    );
  });

  it('rejects a clock with a non-boolean showSeconds', () => {
    registerBuiltInWidgetConfigSchemas();
    const result = validateDisplayDocument(docWith('clock', { showSeconds: 'yes' }));
    expect(result.ok).toBe(false);
  });

  it('accepts a clock missing optional keys', () => {
    registerBuiltInWidgetConfigSchemas();
    const result = validateDisplayDocument(docWith('clock', {}));
    expect(result.ok).toBe(true);
  });

  it('still accepts an unknown type with object config', () => {
    registerBuiltInWidgetConfigSchemas();
    const result = validateDisplayDocument(docWith('mystery-widget', { anything: true }));
    expect(result.ok).toBe(true);
  });
});
