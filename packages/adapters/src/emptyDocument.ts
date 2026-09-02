import { randomUUID } from 'node:crypto';
import type { DisplayDocument } from '@homeslate/schema';

export function createEmptyDisplayDocument(name = 'Homeslate'): DisplayDocument {
  const viewId = randomUUID();
  return {
    schemaVersion: 1,
    name,
    views: [
      {
        id: viewId,
        name: 'Main',
        columns: 12,
        rowHeight: 80,
        widgets: [],
      },
    ],
    activeViewId: viewId,
    rotation: { enabled: false, intervalMs: 30000 },
    themes: [],
    activeThemeId: null,
    settings: {},
  };
}
