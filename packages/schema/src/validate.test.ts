import { describe, expect, it, afterEach } from 'vitest';
import { z } from 'zod';
import {
  clearWidgetConfigSchemas,
  registerWidgetConfigSchema,
  validateDisplayDocument,
} from './validate';

afterEach(() => {
  clearWidgetConfigSchemas();
});

const validWidget = {
  id: 'w1',
  type: 'mystery-widget',
  title: 'Mystery',
  config: { anything: true },
  layout: { x: 0, y: 0, w: 2, h: 2 },
};

const validDoc = {
  schemaVersion: 1 as const,
  name: 'Kitchen',
  views: [
    {
      id: 'v1',
      name: 'Main',
      columns: 12,
      rowHeight: 80,
      widgets: [validWidget],
    },
  ],
  activeViewId: 'v1',
  rotation: { enabled: false, intervalMs: 30000 },
  themes: [],
  activeThemeId: null,
  settings: {},
};

describe('validateDisplayDocument', () => {
  it('accepts an unknown widget type with a valid instance shape', () => {
    const result = validateDisplayDocument(validDoc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.views[0].widgets[0].config).toEqual({ anything: true });
    }
  });

  it('rejects a widget missing layout.x', () => {
    const result = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [{ ...validWidget, layout: { y: 0, w: 2, h: 2 } }],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /layout/i.test(e.path) || /layout/i.test(e.message))).toBe(
        true
      );
    }
  });

  it('rejects a non-object', () => {
    const result = validateDisplayDocument(null);
    expect(result.ok).toBe(false);
  });

  it('rejects v1 with non-array views', () => {
    const result = validateDisplayDocument({ schemaVersion: 1, views: 'invalid' });
    expect(result.ok).toBe(false);
  });

  it('rejects unsupported schema version', () => {
    const result = validateDisplayDocument({ schemaVersion: 2, name: 'Kitchen', views: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
    }
  });

  it('applies a registered config schema to that type only', () => {
    registerWidgetConfigSchema(
      'clock',
      z.object({
        showSeconds: z.boolean(),
        timezone: z.string(),
      })
    );
    const invalid = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [
            { ...validWidget, type: 'clock', config: { showSeconds: 'yes' } },
            validWidget,
          ],
        },
      ],
    });
    expect(invalid.ok).toBe(false);

    const valid = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [
            {
              ...validWidget,
              type: 'clock',
              config: { showSeconds: true, timezone: 'local' },
            },
            validWidget,
          ],
        },
      ],
    });
    expect(valid.ok).toBe(true);
  });

  it('migrates v0 then validates', () => {
    const result = validateDisplayDocument({
      layouts: [
        {
          id: 'v1',
          name: 'Main',
          columns: 12,
          rowHeight: 80,
          widgets: [validWidget],
        },
      ],
      activeLayoutId: 'v1',
      rotationEnabled: false,
      rotationIntervalMs: 30000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.schemaVersion).toBe(1);
      expect(result.document.views[0].id).toBe('v1');
    }
  });
});
