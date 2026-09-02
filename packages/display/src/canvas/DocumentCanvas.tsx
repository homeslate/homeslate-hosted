import { useMemo, useEffect, useRef, useState, useCallback, type JSX } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import { v4 as uuidv4 } from 'uuid';
import { getWidgetByType, getWidgetTypes } from '@homeslate/widgets';
import type { StickyNote, View } from '@homeslate/schema';
import { WidgetWrapper, type WidgetRegistryApi } from './WidgetWrapper';
import { StickyNote as StickyNoteWidget } from './StickyNote';
import { useElementSize } from '@mantine/hooks';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import classes from './DocumentCanvas.module.css';

export type { WidgetRegistryApi };

const DEFAULT_WIDGET_REGISTRY: WidgetRegistryApi = { getWidgetByType, getWidgetTypes };

export function DocumentCanvas(props: {
  view: View;
  isEditing?: boolean;
  stickyNotesEnabled?: boolean;
  notesOverride?: StickyNote[];
  onAddNote?: (note: StickyNote) => void;
  onRemoveNote?: (noteId: string) => void;
  onUpdateNote?: (noteId: string, updates: Partial<StickyNote>) => void;
  onWidgetConfigChange?: (widgetId: string, config: Record<string, unknown>) => void;
  onLayoutChange?: (
    layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>,
  ) => void;
  onRemoveWidget?: (widgetId: string) => void;
  widgetRegistry?: WidgetRegistryApi;
}): JSX.Element {
  const {
    view,
    isEditing = false,
    stickyNotesEnabled = false,
    notesOverride,
    onAddNote,
    onRemoveNote,
    onUpdateNote,
    onWidgetConfigChange,
    onLayoutChange,
    onRemoveWidget,
    widgetRegistry = DEFAULT_WIDGET_REGISTRY,
  } = props;
  const { ref, width, height } = useElementSize();
  const overlayRef = useRef<HTMLDivElement>(null);

  const prevViewId = useRef(view.id);
  const [isFading, setIsFading] = useState(false);
  useEffect(() => {
    if (prevViewId.current !== view.id) {
      prevViewId.current = view.id;
      setIsFading(true);
      const t = setTimeout(() => setIsFading(false), 350);
      return () => clearTimeout(t);
    }
  }, [view.id]);

  const notesEnabled = stickyNotesEnabled;
  const notes: StickyNote[] = notesOverride ?? view.notes ?? [];

  const handleAddNote = useCallback(() => {
    const note: StickyNote = {
      id: uuidv4(),
      text: '',
      x: 10 + Math.random() * 60,
      y: 10 + Math.random() * 60,
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
    };
    onAddNote?.(note);
  }, [onAddNote]);

  const COLS = view.columns;

  const availableWidth = Math.max(0, (width ?? 1200) - CONTAINER_PADDING_X);
  const availableHeight = Math.max(0, (height ?? 0) - CONTAINER_PADDING_Y);
  const rowHeight = Math.max(24, (availableHeight - (MAX_ROWS - 1) * MARGIN_Y) / MAX_ROWS);
  const gridHeight = MAX_ROWS * rowHeight + (MAX_ROWS - 1) * MARGIN_Y;

  const gridLayout = useMemo(
    () =>
      view.widgets.map((widget) => {
        const { x, y, w, h } = widget.layout;
        const maxW = Math.min(widget.layout.maxW ?? COLS, COLS - x);
        const maxH = Math.min(widget.layout.maxH ?? MAX_ROWS, MAX_ROWS - y);
        return {
          i: widget.id,
          x,
          y,
          w,
          h,
          minW: widget.layout.minW,
          minH: widget.layout.minH,
          maxW,
          maxH,
        };
      }),
    [view.widgets, COLS],
  );

  const handleLayoutChange = (
    newLayout: readonly { i: string; x: number; y: number; w: number; h: number }[],
  ) => {
    if (!isEditing) return;
    const clamped = newLayout.map((l: { i: string; x: number; y: number; w: number; h: number }) => {
      const x = Math.max(0, Math.min(l.x, COLS - 1));
      const y = Math.max(0, Math.min(l.y, MAX_ROWS - 1));
      const w = Math.max(1, Math.min(l.w, COLS - x));
      const h = Math.max(1, Math.min(l.h, MAX_ROWS - y));
      return { i: l.i, x, y, w, h };
    });
    onLayoutChange?.(clamped);
  };

  return (
    <div ref={ref} className={`${classes.container} ${isFading ? classes.fadeIn : ''}`}>
      {view.widgets.length === 0 ? (
        <div className={classes.empty} />
      ) : (
        <div
          className={classes.gridWrapper}
          style={{ width: availableWidth, height: gridHeight }}
        >
          <GridLayout
            className={`${classes.grid} ${isEditing ? classes.editing : ''}`}
            layout={gridLayout}
            cols={COLS}
            rowHeight={rowHeight}
            width={availableWidth}
            maxRows={MAX_ROWS}
            onLayoutChange={handleLayoutChange}
            isDraggable={isEditing}
            isResizable={isEditing}
            draggableHandle=".widget-drag-handle"
            compactType="vertical"
            preventCollision={false}
            isBounded={true}
            margin={[MARGIN_X, MARGIN_Y]}
            resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
          >
            {view.widgets.map((widget) => (
              <div key={widget.id} className={classes.widgetContainer}>
                <WidgetWrapper
                  widget={widget}
                  isEditing={isEditing}
                  widgetRegistry={widgetRegistry}
                  onConfigChange={(config) => onWidgetConfigChange?.(widget.id, config)}
                  onRemove={() => onRemoveWidget?.(widget.id)}
                />
              </div>
            ))}
          </GridLayout>
        </div>
      )}

      {notesEnabled && (
        <>
          <div className={classes.notesOverlay} ref={overlayRef}>
            {notes.map((note) => (
              <StickyNoteWidget
                key={note.id}
                note={note}
                containerRef={overlayRef}
                onUpdate={(updates) => onUpdateNote?.(note.id, updates)}
                onRemove={() => onRemoveNote?.(note.id)}
              />
            ))}
          </div>
          <button className={classes.addNoteBtn} onClick={handleAddNote} title="Add sticky note">
            +
          </button>
        </>
      )}
    </div>
  );
}

const MARGIN_X = 16;
const MARGIN_Y = 16;
const MAX_ROWS = 12;
const CONTAINER_PADDING_X = 32;
const CONTAINER_PADDING_Y = 64;

const NOTE_COLORS: StickyNote['color'][] = ['yellow', 'pink', 'blue', 'green'];
