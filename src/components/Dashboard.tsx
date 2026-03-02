import { useMemo, useEffect, useRef, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import GridLayoutImport from 'react-grid-layout';
const GridLayout = GridLayoutImport as any;
import { useDashboardStore } from '../store/dashboardStore';
import { WidgetWrapper } from './WidgetWrapper';
import { useElementSize } from '@mantine/hooks';
import type { DashboardLayout } from '../types/widget';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import classes from './Dashboard.module.css';

interface Props {
  layoutId?: string;           // override which layout to show
  isEditing?: boolean;         // override editable state
  externalLayouts?: DashboardLayout[]; // for DisplayViewer (bypasses store)
}

export function Dashboard({ layoutId, isEditing: isEditingProp, externalLayouts }: Props) {
  const store = useDashboardStore();
  const { ref, width } = useElementSize();

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

  if (!activeLayout) {
    return (
      <div className={classes.empty}>
        <p>No layout selected</p>
      </div>
    );
  }

  const gridLayout = activeLayout.widgets.map((widget) => ({
    i: widget.id,
    x: widget.layout.x,
    y: widget.layout.y,
    w: widget.layout.w,
    h: widget.layout.h,
    minW: widget.layout.minW,
    minH: widget.layout.minH,
    maxW: widget.layout.maxW,
    maxH: widget.layout.maxH,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLayoutChange = (newLayout: any[]) => {
    if (!isEditing) return;
    store.updateAllWidgetLayouts(
      newLayout.map((l: { i: string; x: number; y: number; w: number; h: number }) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
      }))
    );
  };

  const calculatedWidth = width || 1200;

  return (
    <div ref={ref} className={`${classes.container} ${isFading ? classes.fadeIn : ''}`}>
      {activeLayout.widgets.length === 0 ? (
        <div className={classes.empty}>
          <h2>Empty View</h2>
          <p>Click a widget in the left panel to add it here</p>
        </div>
      ) : (
        <GridLayout
          className={`${classes.grid} ${isEditing ? classes.editing : ''}`}
          layout={gridLayout}
          cols={activeLayout.columns}
          rowHeight={activeLayout.rowHeight}
          width={calculatedWidth}
          onLayoutChange={handleLayoutChange}
          isDraggable={isEditing}
          isResizable={isEditing}
          draggableHandle=".widget-drag-handle"
          compactType="vertical"
          preventCollision={false}
          isBounded={true}
          margin={[16, 16]}
          resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
        >
          {activeLayout.widgets.map((widget) => (
            <div key={widget.id} className={classes.widgetContainer}>
              <WidgetWrapper widget={widget} isEditing={isEditing} />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
