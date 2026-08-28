import { describe, expect, it } from 'vitest';
import { migrateDisplayDocument } from '@homeslate/schema';
import { readStoredConfig, toLegacyConfig, writeStoredConfig } from './displayDocumentBridge';

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
});

describe('writeStoredConfig / readStoredConfig', () => {
  it('accepts v0 PUT bodies and returns a v1 document', () => {
    const written = writeStoredConfig(v0);
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.document.schemaVersion).toBe(1);
    expect(written.document.views[0].id).toBe('view-1');
  });

  it('rejects invalid PUT bodies', () => {
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

  it('readStoredConfig always yields legacy layouts even if the row is already v1', () => {
    const written = writeStoredConfig(v0);
    if (!written.ok) throw new Error('expected ok');
    const read = readStoredConfig(written.document);
    expect((read.legacy.layouts as unknown[]).length).toBe(1);
    expect(read.document.schemaVersion).toBe(1);
  });
});
