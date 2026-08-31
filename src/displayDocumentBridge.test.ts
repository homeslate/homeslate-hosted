import { describe, expect, it } from 'vitest';
import { migrateDisplayDocument } from '@homeslate/schema';
import {
  readStoredConfig,
  toLegacyConfig,
  writeKioskConfig,
  writeStoredConfig,
} from './displayDocumentBridge';

const v0 = {
  layouts: [
    {
      id: 'view-1',
      name: 'Morning',
      columns: 12,
      rowHeight: 80,
      widgets: [
        {
          id: 'w1',
          type: 'clock',
          title: 'Clock',
          config: {},
          layout: { x: 0, y: 0, w: 2, h: 2 },
        },
      ],
      backgroundImage: 'https://example.com/bg.jpg',
      backgroundImageSize: 'cover',
      backgroundOverlayOpacity: 0.2,
      backgroundPhotos: [{ type: 'stored', key: 'k', filename: 'f.png' }],
      backgroundInterval: 9,
      notes: [{ id: 'n1', text: 'hi', x: 1, y: 2, color: 'pink' }],
    },
  ],
  activeLayoutId: 'view-1',
  rotationEnabled: true,
  rotationIntervalMs: 12000,
  stickyNotesEnabled: true,
  voiceEnabled: true,
  colorMode: 'light',
};

describe('toLegacyConfig', () => {
  it('round-trips v0 through v1 back to layouts for the current UI', () => {
    const document = migrateDisplayDocument(v0);
    const legacy = toLegacyConfig(document);
    expect(legacy.layouts).toHaveLength(1);
    const layout = (legacy.layouts as Array<Record<string, unknown>>)[0];
    expect(layout.id).toBe('view-1');
    expect(layout.backgroundImage).toBe('https://example.com/bg.jpg');
    expect(layout.backgroundImageSize).toBe('cover');
    expect(layout.backgroundOverlayOpacity).toBe(0.2);
    expect(layout.backgroundPhotos).toEqual([{ type: 'stored', key: 'k', filename: 'f.png' }]);
    expect(layout.backgroundInterval).toBe(9);
    expect(layout.notes).toEqual(v0.layouts[0].notes);
    expect(legacy.activeLayoutId).toBe('view-1');
    expect(legacy.rotationEnabled).toBe(true);
    expect(legacy.rotationIntervalMs).toBe(12000);
    expect(legacy.stickyNotesEnabled).toBe(true);
    expect(legacy.voiceEnabled).toBe(true);
    expect(legacy.colorMode).toBe('light');
    expect(legacy.schemaVersion).toBeUndefined();
    expect(legacy.views).toBeUndefined();
  });

  it('round-trips unknown widget type and object config', () => {
    const v0WithCustom = {
      ...v0,
      layouts: [
        {
          ...v0.layouts[0],
          widgets: [
            {
              id: 'w-custom',
              type: 'my-custom',
              title: 'Custom',
              config: { foo: 'bar' },
              layout: { x: 0, y: 0, w: 2, h: 2 },
            },
          ],
        },
      ],
    };
    const document = migrateDisplayDocument(v0WithCustom);
    const legacy = toLegacyConfig(document);
    const layout = (legacy.layouts as Array<Record<string, unknown>>)[0];
    expect(layout.widgets).toEqual([
      {
        id: 'w-custom',
        type: 'my-custom',
        title: 'Custom',
        config: { foo: 'bar' },
        layout: { x: 0, y: 0, w: 2, h: 2 },
      },
    ]);
  });

  it('preserves URL background photos on round-trip', () => {
    const v0WithUrlPhoto = {
      ...v0,
      layouts: [
        {
          ...v0.layouts[0],
          backgroundPhotos: [
            { type: 'url', url: 'https://example.com/a.jpg', caption: 'A' },
            { type: 'stored', key: 'k', filename: 'f.png' },
          ],
        },
      ],
    };
    const document = migrateDisplayDocument(v0WithUrlPhoto);
    const legacy = toLegacyConfig(document);
    const layout = (legacy.layouts as Array<Record<string, unknown>>)[0];
    expect(layout.backgroundPhotos).toEqual([
      { type: 'url', url: 'https://example.com/a.jpg', caption: 'A' },
      { type: 'stored', key: 'k', filename: 'f.png' },
    ]);
  });
});

describe('writeStoredConfig / readStoredConfig', () => {
  it('accepts v0 PUT bodies and returns a v1 document', () => {
    const written = writeStoredConfig(v0);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.document.schemaVersion).toBe(1);
    expect(written.document.views[0].id).toBe('view-1');
  });

  it('rejects empty object PUT bodies', () => {
    const written = writeStoredConfig({});
    expect(written.ok).toBe(false);
  });

  it('rejects { layouts: [] } missing required v0 root fields', () => {
    const written = writeStoredConfig({ layouts: [] });
    expect(written.ok).toBe(false);
  });

  it('rejects v0 PUT missing rotationEnabled', () => {
    const written = writeStoredConfig({
      layouts: [],
      activeLayoutId: null,
      rotationIntervalMs: 12000,
    });
    expect(written.ok).toBe(false);
  });

  it('accepts v0 PUT with empty layouts when required roots are present', () => {
    const written = writeStoredConfig({
      layouts: [],
      activeLayoutId: null,
      rotationEnabled: false,
      rotationIntervalMs: 12000,
    });
    expect(written.ok).toBe(true);
  });

  it('readStoredConfig still migrates messy rows like {}', () => {
    const read = readStoredConfig({});
    expect(read.document.schemaVersion).toBe(1);
    expect(Array.isArray(read.legacy.layouts)).toBe(true);
  });

  it('rejects invalid PUT bodies missing widget layout', () => {
    const written = writeStoredConfig({
      layouts: [
        {
          id: 'view-1',
          name: 'Morning',
          columns: 12,
          rowHeight: 80,
          widgets: [{ id: 'w1', type: 'clock', title: 'Clock', config: {} }],
        },
      ],
      activeLayoutId: 'view-1',
      rotationEnabled: true,
      rotationIntervalMs: 12000,
    });
    expect(written.ok).toBe(false);
  });

  it('rejects PUT with widget missing type', () => {
    const written = writeStoredConfig({
      layouts: [
        {
          id: 'view-1',
          name: 'Morning',
          columns: 12,
          rowHeight: 80,
          widgets: [
            {
              id: 'w1',
              title: 'Clock',
              config: {},
              layout: { x: 0, y: 0, w: 2, h: 2 },
            },
          ],
        },
      ],
      activeLayoutId: 'view-1',
      rotationEnabled: true,
      rotationIntervalMs: 12000,
    });
    expect(written.ok).toBe(false);
  });

  it('rejects PUT with non-object widget config', () => {
    const written = writeStoredConfig({
      layouts: [
        {
          id: 'view-1',
          name: 'Morning',
          columns: 12,
          rowHeight: 80,
          widgets: [
            {
              id: 'w1',
              type: 'clock',
              title: 'Clock',
              config: 'bad',
              layout: { x: 0, y: 0, w: 2, h: 2 },
            },
          ],
        },
      ],
      activeLayoutId: 'view-1',
      rotationEnabled: true,
      rotationIntervalMs: 12000,
    });
    expect(written.ok).toBe(false);
  });

  it('readStoredConfig always yields legacy layouts even if the row is already v1', () => {
    const written = writeStoredConfig(v0);
    if (!written.ok) throw new Error('expected ok');
    const read = readStoredConfig(written.document);
    expect((read.legacy.layouts as unknown[]).length).toBe(1);
    expect(read.document.schemaVersion).toBe(1);
  });
});

describe('writeKioskConfig', () => {
  function patchTodos(document: ReturnType<typeof readStoredConfig>['document']) {
    return {
      ...document,
      views: document.views.map((view) => ({
        ...view,
        widgets: view.widgets.map((widget) => ({
          ...widget,
          config: { ...widget.config, items: [{ id: 't1', text: 'milk', checked: false }] },
        })),
      })),
    };
  }

  it('reports no errors and returns the patched document for a valid row', () => {
    const { document } = readStoredConfig(v0);
    const written = writeKioskConfig(patchTodos(document));
    expect(written.errors).toEqual([]);
    expect(written.document.views[0].widgets[0].config.items).toEqual([
      { id: 't1', text: 'milk', checked: false },
    ]);
  });

  it('still returns the patched document when the stored row has an empty view name', () => {
    const { document } = readStoredConfig({
      ...v0,
      layouts: [{ ...v0.layouts[0], name: '' }],
    });
    const written = writeKioskConfig(patchTodos(document));
    expect(written.errors.map((e) => e.path)).toContain('views.0.name');
    expect(written.document.views[0].widgets[0].config.items).toEqual([
      { id: 't1', text: 'milk', checked: false },
    ]);
  });

  it('still returns the patched document when activeThemeId is dangling', () => {
    const { document } = readStoredConfig({ ...v0, activeThemeId: 'missing-theme' });
    const written = writeKioskConfig(patchTodos(document));
    expect(written.errors.map((e) => e.path)).toContain('activeThemeId');
    expect(written.document.activeThemeId).toBe('missing-theme');
    expect(written.document.views[0].widgets[0].config.items).toEqual([
      { id: 't1', text: 'milk', checked: false },
    ]);
  });

  it('keeps an existing document name instead of forcing the default', () => {
    const named = readStoredConfig({ ...v0, name: 'Kitchen' });
    expect(writeKioskConfig(patchTodos(named.document)).document.name).toBe('Kitchen');

    const invalidRow = readStoredConfig({
      ...v0,
      name: 'Kitchen',
      layouts: [{ ...v0.layouts[0], name: '' }],
    });
    expect(writeKioskConfig(patchTodos(invalidRow.document)).document.name).toBe('Kitchen');
  });
});
