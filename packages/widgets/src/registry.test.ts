import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  clearWidgetConfigSchemas,
  validateDisplayDocument,
} from '@homeslate/schema';
import {
  clearWidgetRegistry,
  getWidgetByType,
  getWidgetTypes,
  registerWidget,
} from './registry';
import type { WidgetProps } from './types';

afterEach(() => {
  clearWidgetRegistry();
  clearWidgetConfigSchemas();
});

function Dummy({}: WidgetProps) {
  return null;
}

function DummyIcon({}: { size?: number | string }) {
  return null;
}

const validDoc = {
  schemaVersion: 1 as const,
  name: 'Kitchen',
  views: [
    {
      id: 'v1',
      name: 'Main',
      columns: 12,
      rowHeight: 80,
      widgets: [
        {
          id: 'w1',
          type: 'clock',
          title: 'Clock',
          config: { showSeconds: true },
          layout: { x: 0, y: 0, w: 2, h: 2 },
        },
      ],
    },
  ],
  activeViewId: 'v1',
  rotation: { enabled: false, intervalMs: 30000 },
  themes: [],
  activeThemeId: null,
  settings: {},
};

describe('registerWidget', () => {
  it('looks up a registered type', () => {
    registerWidget({
      type: 'clock',
      name: 'Clock',
      description: 'Time',
      icon: DummyIcon,
      component: Dummy,
      defaultConfig: { showSeconds: true },
      defaultLayout: { w: 3, h: 2 },
    });
    expect(getWidgetByType('clock')?.name).toBe('Clock');
    expect(getWidgetTypes().map((e) => e.type)).toEqual(['clock']);
  });

  it('registers configSchema with @homeslate/schema', () => {
    registerWidget({
      type: 'clock',
      name: 'Clock',
      description: 'Time',
      icon: DummyIcon,
      component: Dummy,
      defaultConfig: {},
      defaultLayout: { w: 3, h: 2 },
      configSchema: z.object({ showSeconds: z.boolean().optional() }),
    });
    const invalid = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [
            {
              ...validDoc.views[0].widgets[0],
              config: { showSeconds: 'yes' },
            },
          ],
        },
      ],
    });
    expect(invalid.ok).toBe(false);

    const valid = validateDisplayDocument(validDoc);
    expect(valid.ok).toBe(true);
  });

  it('accepts a custom type with no configSchema', () => {
    registerWidget({
      type: 'custom-weather',
      name: 'Custom',
      description: 'Host widget',
      icon: DummyIcon,
      component: Dummy,
      defaultConfig: { foo: 1 },
      defaultLayout: { w: 2, h: 2 },
    });
    expect(getWidgetByType('custom-weather')?.type).toBe('custom-weather');
    const result = validateDisplayDocument({
      ...validDoc,
      views: [
        {
          ...validDoc.views[0],
          widgets: [
            {
              id: 'w2',
              type: 'custom-weather',
              title: 'X',
              config: { anything: true },
              layout: { x: 0, y: 0, w: 2, h: 2 },
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
  });
});
