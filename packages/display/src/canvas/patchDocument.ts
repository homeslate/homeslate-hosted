import type { DisplayDocument, StickyNote, View, WidgetInstance } from '@homeslate/schema';

function mapView(
  document: DisplayDocument,
  viewId: string,
  fn: (view: View) => View,
): DisplayDocument {
  let found = false;
  const views = document.views.map((view) => {
    if (view.id !== viewId) return view;
    found = true;
    return fn(view);
  });
  if (!found) return document;
  return { ...document, views };
}

export function patchView(
  document: DisplayDocument,
  viewId: string,
  patch: Partial<View>,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({ ...view, ...patch }));
}

export function replaceViewWidgets(
  document: DisplayDocument,
  viewId: string,
  widgets: WidgetInstance[],
): DisplayDocument {
  return mapView(document, viewId, (view) => ({ ...view, widgets }));
}

export function patchWidgetConfig(
  document: DisplayDocument,
  viewId: string,
  widgetId: string,
  config: Record<string, unknown>,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({
    ...view,
    widgets: view.widgets.map((widget) =>
      widget.id === widgetId
        ? { ...widget, config: { ...widget.config, ...config } }
        : widget,
    ),
  }));
}

export function removeWidget(
  document: DisplayDocument,
  viewId: string,
  widgetId: string,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({
    ...view,
    widgets: view.widgets.filter((widget) => widget.id !== widgetId),
  }));
}

export function addWidget(
  document: DisplayDocument,
  viewId: string,
  widget: WidgetInstance,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({
    ...view,
    widgets: [...view.widgets, widget],
  }));
}

export function patchViewNotes(
  document: DisplayDocument,
  viewId: string,
  notes: StickyNote[],
): DisplayDocument {
  return mapView(document, viewId, (view) => ({ ...view, notes }));
}

export function applyWidgetLayouts(
  document: DisplayDocument,
  viewId: string,
  layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>,
): DisplayDocument {
  return mapView(document, viewId, (view) => ({
    ...view,
    widgets: view.widgets.map((widget) => {
      const next = layouts.find((item) => item.i === widget.id);
      if (!next) return widget;
      return {
        ...widget,
        layout: { ...widget.layout, x: next.x, y: next.y, w: next.w, h: next.h },
      };
    }),
  }));
}
