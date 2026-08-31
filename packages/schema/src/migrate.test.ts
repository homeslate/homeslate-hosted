import { describe, expect, it } from 'vitest';
import { migrateDisplayDocument } from './migrate';

const v0Kitchen = {
  layouts: [
    {
      id: 'view-1',
      name: 'Morning',
      icon: 'IconHome',
      hidden: false,
      columns: 12,
      rowHeight: 80,
      widgets: [
        {
          id: 'w-clock',
          type: 'clock',
          title: 'Clock',
          config: { showSeconds: true, timezone: 'local' },
          layout: { x: 0, y: 0, w: 3, h: 2 },
        },
        {
          id: 'w-custom',
          type: 'my-custom',
          title: 'Custom',
          config: { foo: 'bar' },
          layout: { x: 3, y: 0, w: 2, h: 2, minW: 1 },
        },
      ],
      backgroundImage: 'https://example.com/bg.jpg',
      backgroundImageSize: 'cover',
      backgroundOverlayOpacity: 0.4,
      backgroundPhotos: [
        { type: 'url', url: 'https://example.com/a.jpg', caption: 'A' },
        { type: 'stored', key: 'blob-1', filename: 'pic.png' },
      ],
      backgroundInterval: 12,
      notes: [{ id: 'n1', text: 'Buy milk', x: 10, y: 20, color: 'yellow' }],
    },
  ],
  activeLayoutId: 'view-1',
  rotationEnabled: true,
  rotationIntervalMs: 15000,
  colorMode: 'dark',
  stickyNotesEnabled: true,
  voiceEnabled: false,
  holidayEffectsEnabled: true,
  holidayPreviewId: 'halloween',
  alarms: [
    {
      id: 'a1',
      label: 'Dinner',
      enabled: true,
      time: '19:00',
      days: [1, 2, 3, 4, 5],
      toneId: 'chime',
    },
  ],
  themes: [{ id: 't1', name: 'Default', version: 1, isActive: true, tokens: {} }],
  activeThemeId: 't1',
};

describe('migrateDisplayDocument', () => {
  it('maps v0 layouts to v1 views and nests settings', () => {
    const doc = migrateDisplayDocument(v0Kitchen);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.name).toBe('Homeslate');
    expect(doc.activeViewId).toBe('view-1');
    expect(doc.rotation).toEqual({ enabled: true, intervalMs: 15000 });
    expect(doc.colorMode).toBe('dark');
    expect(doc.settings).toEqual({
      stickyNotesEnabled: true,
      voiceEnabled: false,
      holidayEffectsEnabled: true,
      holidayPreviewId: 'halloween',
    });
    expect(doc.alarms).toEqual(v0Kitchen.alarms);
    expect(doc.activeThemeId).toBe('t1');
    expect(doc.views).toHaveLength(1);
    const view = doc.views[0];
    expect(view.id).toBe('view-1');
    expect(view.name).toBe('Morning');
    expect(view.icon).toBe('IconHome');
    expect(view.hidden).toBe(false);
    expect(view.columns).toBe(12);
    expect(view.rowHeight).toBe(80);
    expect(view.notes).toEqual(v0Kitchen.layouts[0].notes);
    expect(view.background).toEqual({
      image: 'https://example.com/bg.jpg',
      imageSize: 'cover',
      overlayOpacity: 0.4,
      photos: v0Kitchen.layouts[0].backgroundPhotos,
      intervalSeconds: 12,
    });
    expect(view.widgets[0].type).toBe('clock');
    expect(view.widgets[1].type).toBe('my-custom');
    expect(view.widgets[1].config).toEqual({ foo: 'bar' });
    expect(view.widgets[1].layout.minW).toBe(1);
  });

  it('preserves stored background photos instead of collapsing to url+caption', () => {
    const doc = migrateDisplayDocument(v0Kitchen);
    const photos = doc.views[0].background?.photos;
    expect(photos?.[1]).toEqual({ type: 'stored', key: 'blob-1', filename: 'pic.png' });
  });

  it('defaults rotation interval and empty views for a bare object', () => {
    const doc = migrateDisplayDocument({});
    expect(doc).toEqual({
      schemaVersion: 1,
      name: 'Homeslate',
      views: [],
      activeViewId: null,
      rotation: { enabled: false, intervalMs: 30000 },
      themes: [],
      activeThemeId: null,
      settings: {},
    });
  });

  it('is identity for v1 documents', () => {
    const v1 = migrateDisplayDocument(v0Kitchen);
    const again = migrateDisplayDocument(v1);
    expect(again).toEqual(v1);
  });

  it('preserves empty optional strings and empty background on hand-authored v1', () => {
    const v1 = {
      schemaVersion: 1,
      name: 'Homeslate',
      views: [
        {
          id: 'view-1',
          name: 'Morning',
          icon: '',
          columns: 12,
          rowHeight: 80,
          widgets: [],
          background: { image: '' },
        },
        {
          id: 'view-2',
          name: 'Evening',
          columns: 12,
          rowHeight: 80,
          widgets: [],
          background: {},
        },
      ],
      activeViewId: 'view-1',
      rotation: { enabled: false, intervalMs: 30000 },
      themes: [],
      activeThemeId: null,
      settings: {},
    };
    expect(migrateDisplayDocument(v1)).toEqual(v1);
  });

  it('uses document.name when present on v0', () => {
    const doc = migrateDisplayDocument({ ...v0Kitchen, name: 'Kitchen' });
    expect(doc.name).toBe('Kitchen');
  });

  it('throws on non-object input', () => {
    expect(() => migrateDisplayDocument(null)).toThrow(/plain object/);
    expect(() => migrateDisplayDocument([])).toThrow(/plain object/);
    expect(() => migrateDisplayDocument('nope')).toThrow(/plain object/);
  });
});
