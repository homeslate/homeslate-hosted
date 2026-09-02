import { describe, expect, it } from 'vitest';
import type { DisplayDocument, WidgetInstance } from '@homeslate/schema';
import {
  addWidget,
  applyWidgetLayouts,
  findAvailablePosition,
  patchView,
  patchViewNotes,
  patchWidgetConfig,
  removeWidget,
  replaceViewWidgets,
} from './patchDocument';

const widget = (id: string, extra?: Partial<WidgetInstance>): WidgetInstance => ({
  id,
  type: 'clock',
  title: 'Clock',
  config: { showSeconds: true },
  layout: { x: 0, y: 0, w: 2, h: 2 },
  ...extra,
});

const doc = (): DisplayDocument => ({
  schemaVersion: 1,
  name: 'Kitchen',
  views: [
    {
      id: 'morning',
      name: 'Morning',
      columns: 12,
      rowHeight: 80,
      widgets: [widget('w1')],
      notes: [],
    },
  ],
  activeViewId: 'morning',
  rotation: { enabled: false, intervalMs: 30000 },
  themes: [],
  activeThemeId: null,
  settings: {},
});

describe('patchDocument', () => {
  it('patchView updates one view and leaves others intact', () => {
    const next = patchView(doc(), 'morning', { name: 'Dawn' });
    expect(next.views[0].name).toBe('Dawn');
    expect(next).not.toBe(doc());
  });

  it('patchWidgetConfig merges config on the matching widget', () => {
    const next = patchWidgetConfig(doc(), 'morning', 'w1', { showSeconds: false, extra: 1 });
    expect(next.views[0].widgets[0].config).toEqual({ showSeconds: false, extra: 1 });
  });

  it('removeWidget drops the widget from the view', () => {
    const next = removeWidget(doc(), 'morning', 'w1');
    expect(next.views[0].widgets).toEqual([]);
  });

  it('addWidget appends a widget', () => {
    const w2 = widget('w2');
    const next = addWidget(doc(), 'morning', w2);
    expect(next.views[0].widgets.map((w) => w.id)).toEqual(['w1', 'w2']);
  });

  it('findAvailablePosition skips occupied cells and returns the first fit', () => {
    const occupied = [widget('w1', { layout: { x: 0, y: 0, w: 2, h: 2 } })];
    expect(findAvailablePosition(occupied, 12, 2, 2)).toEqual({ x: 2, y: 0 });
  });

  it('findAvailablePosition falls back to the origin when the grid is full', () => {
    const occupied = [widget('w1', { layout: { x: 0, y: 0, w: 12, h: 12 } })];
    expect(findAvailablePosition(occupied, 12, 2, 2)).toEqual({ x: 0, y: 0 });
  });

  it('applyWidgetLayouts updates x/y/w/h and preserves minW', () => {
    const start = addWidget(doc(), 'morning', widget('w2', { layout: { x: 2, y: 0, w: 2, h: 2, minW: 2 } }));
    const next = applyWidgetLayouts(start, 'morning', [
      { i: 'w1', x: 1, y: 1, w: 3, h: 3 },
      { i: 'w2', x: 4, y: 0, w: 2, h: 2 },
    ]);
    expect(next.views[0].widgets[0].layout).toMatchObject({ x: 1, y: 1, w: 3, h: 3 });
    expect(next.views[0].widgets[1].layout.minW).toBe(2);
  });

  it('patchViewNotes replaces notes on the view', () => {
    const notes = [{ id: 'n1', text: 'hi', x: 10, y: 10, color: 'yellow' }];
    const next = patchViewNotes(doc(), 'morning', notes);
    expect(next.views[0].notes).toEqual(notes);
  });

  it('unknown viewId returns the same document reference', () => {
    const start = doc();
    expect(patchView(start, 'missing', { name: 'x' })).toBe(start);
    expect(removeWidget(start, 'missing', 'w1')).toBe(start);
  });

  it('unknown widgetId returns the same document reference', () => {
    const start = doc();
    expect(patchWidgetConfig(start, 'morning', 'missing', { showSeconds: false })).toBe(start);
    expect(removeWidget(start, 'morning', 'missing')).toBe(start);
  });

  it('replaceViewWidgets swaps the widget list', () => {
    const next = replaceViewWidgets(doc(), 'morning', [widget('w9')]);
    expect(next.views[0].widgets.map((w) => w.id)).toEqual(['w9']);
  });
});
