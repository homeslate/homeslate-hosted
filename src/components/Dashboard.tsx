import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import { v4 as uuidv4 } from 'uuid';
import { useDashboardStore } from '../store/dashboardStore';
import { WidgetWrapper } from './WidgetWrapper';
import { StickyNote as StickyNoteWidget } from './StickyNote';
import { useElementSize } from '@mantine/hooks';
import type { DashboardLayout, StickyNote } from '../types/widget';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import classes from './Dashboard.module.css';

interface Props {
  layoutId?: string;           // override which layout to show
  isEditing?: boolean;         // override editable state
  externalLayouts?: DashboardLayout[]; // for DisplayViewer (bypasses store)
  // Sticky notes (viewer mode pass-through)
  stickyNotesEnabled?: boolean;
  notesOverride?: StickyNote[];
  onAddNote?: (note: StickyNote) => void;
  onRemoveNote?: (noteId: string) => void;
  onUpdateNote?: (noteId: string, updates: Partial<StickyNote>) => void;
  // Widget config overrides (e.g. todo items from display viewer)
  onWidgetConfigChange?: (widgetId: string, config: Record<string, unknown>) => void;
}

const MARGIN_X = 16;
const MARGIN_Y = 16;
const MAX_ROWS = 12;
const CONTAINER_PADDING_X = 32; // 1rem left + 1rem right
const CONTAINER_PADDING_Y = 64; // 1rem top + 3rem bottom

const NOTE_COLORS: StickyNote['color'][] = ['yellow', 'pink', 'blue', 'green'];

export function Dashboard({
  layoutId,
  isEditing: isEditingProp,
  externalLayouts,
  stickyNotesEnabled,
  notesOverride,
  onAddNote,
  onRemoveNote,
  onUpdateNote,
  onWidgetConfigChange,
}: Props) {
  const store = useDashboardStore();
  const { ref, width, height } = useElementSize();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Resolve which display/layout to show
  const storeDisplay = store.displays.find((d) => d.id === store.selectedDisplayId);
  const layouts = externalLayouts ?? storeDisplay?.layouts ?? [];
  const resolvedLayoutId = layoutId ?? storeDisplay?.activeLayoutId ?? null;
  const isEditing = isEditingProp ?? false;

  const activeLayout = useMemo(
    () => layouts.find((l) => l.id === resolvedLayoutId),
    [layouts, resolvedLayoutId]
  );

  // Fade-in animation on view change
  const prevLayoutId = useRef(resolvedLayoutId);
  const [isFading, setIsFading] = useState(false);
  useEffect(() => {
    if (prevLayoutId.current !== resolvedLayoutId) {
      prevLayoutId.current = resolvedLayoutId;
      setIsFading(true);
      const t = setTimeout(() => setIsFading(false), 350);
      return () => clearTimeout(t);
    }
  }, [resolvedLayoutId]);

  // Determine if notes are enabled
  const notesEnabled =
    stickyNotesEnabled !== undefined
      ? stickyNotesEnabled
      : isEditing && (storeDisplay?.stickyNotesEnabled ?? false);

  // Notes data: viewer override takes priority, then layout's stored notes
  const notes: StickyNote[] = notesOverride ?? activeLayout?.notes ?? [];

  // Editor-mode note mutations via store
  const handleAddNoteEditor = useCallback(
    (note: StickyNote) => {
      if (resolvedLayoutId) store.addNote(resolvedLayoutId, note);
    },
    [resolvedLayoutId, store]
  );

  const handleRemoveNoteEditor = useCallback(
    (noteId: string) => {
      if (resolvedLayoutId) store.removeNote(resolvedLayoutId, noteId);
    },
    [resolvedLayoutId, store]
  );

  const handleUpdateNoteEditor = useCallback(
    (noteId: string, updates: Partial<StickyNote>) => {
      if (resolvedLayoutId) store.updateNote(resolvedLayoutId, noteId, updates);
    },
    [resolvedLayoutId, store]
  );

  const handleAddNote = useCallback(() => {
    const note: StickyNote = {
      id: uuidv4(),
      text: '',
      x: 10 + Math.random() * 60,
      y: 10 + Math.random() * 60,
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
    };
    if (onAddNote) {
      onAddNote(note);
    } else {
      handleAddNoteEditor(note);
    }
  }, [onAddNote, handleAddNoteEditor]);

  if (!activeLayout) {
    return <div className={classes.empty} />;
  }

  const COLS = activeLayout.columns;

  // Calculate dimensions so 12x12 grid fits exactly in the viewport (no scrolling)
  const availableWidth = Math.max(0, (width ?? 1200) - CONTAINER_PADDING_X);
  const availableHeight = Math.max(0, (height ?? 0) - CONTAINER_PADDING_Y);
  const rowHeight = Math.max(24, (availableHeight - (MAX_ROWS - 1) * MARGIN_Y) / MAX_ROWS);
  const gridHeight = MAX_ROWS * rowHeight + (MAX_ROWS - 1) * MARGIN_Y;

  const gridLayout = activeLayout.widgets.map((widget) => {
    const { x, y, w, h } = widget.layout;
    // Clamp maxW/maxH to grid bounds so resize handles can't extend past the 12x12 grid
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
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLayoutChange = (newLayout: readonly any[]) => {
    if (!isEditing) return;
    // Clamp all layout items to the 12x12 grid bounds
    const clamped = newLayout.map((l: { i: string; x: number; y: number; w: number; h: number }) => {
      const x = Math.max(0, Math.min(l.x, COLS - 1));
      const y = Math.max(0, Math.min(l.y, MAX_ROWS - 1));
      const w = Math.max(1, Math.min(l.w, COLS - x));
      const h = Math.max(1, Math.min(l.h, MAX_ROWS - y));
      return { i: l.i, x, y, w, h };
    });
    store.updateAllWidgetLayouts(clamped);
  };

  return (
    <div ref={ref} className={`${classes.container} ${isFading ? classes.fadeIn : ''}`}>
      {activeLayout.widgets.length === 0 ? (
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
            {activeLayout.widgets.map((widget) => (
              <div key={widget.id} className={classes.widgetContainer}>
                <WidgetWrapper
                  widget={widget}
                  isEditing={isEditing}
                  onConfigChangeOverride={onWidgetConfigChange}
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
                onUpdate={(updates) =>
                  onUpdateNote
                    ? onUpdateNote(note.id, updates)
                    : handleUpdateNoteEditor(note.id, updates)
                }
                onRemove={() =>
                  onRemoveNote ? onRemoveNote(note.id) : handleRemoveNoteEditor(note.id)
                }
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
