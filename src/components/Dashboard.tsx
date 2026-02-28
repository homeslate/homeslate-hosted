import { useMemo, useEffect, useRef, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import GridLayoutImport from 'react-grid-layout';
const GridLayout = GridLayoutImport as any;
import { useDashboardStore } from '../store/dashboardStore';
import { WidgetWrapper } from './WidgetWrapper';
import { useElementSize } from '@mantine/hooks';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import classes from './Dashboard.module.css';

export function Dashboard() {
  const { layouts, activeLayoutId, isEditing, updateAllWidgetLayouts } = useDashboardStore();
  const { ref, width } = useElementSize();
  
  const activeLayout = useMemo(() =>
    layouts.find((l) => l.id === activeLayoutId),
    [layouts, activeLayoutId]
  );

  // Trigger fade-in animation whenever the active view changes
  const prevLayoutId = useRef(activeLayoutId);
  const [isFading, setIsFading] = useState(false);
  useEffect(() => {
    if (prevLayoutId.current !== activeLayoutId) {
      prevLayoutId.current = activeLayoutId;
      setIsFading(true);
      const t = setTimeout(() => setIsFading(false), 350);
      return () => clearTimeout(t);
    }
  }, [activeLayoutId]);

  if (!activeLayout) {
    return (
      <div className={classes.empty}>
        <p>No layout selected</p>
      </div>
    );
  }

  const gridLayout = activeLayout.widgets.map(widget => ({
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
    updateAllWidgetLayouts(newLayout.map((l: { i: string; x: number; y: number; w: number; h: number }) => ({
      i: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
    })));
  };

  const calculatedWidth = width || 1200;

  return (
    <div ref={ref} className={`${classes.container} ${isFading ? classes.fadeIn : ''}`}>
      {activeLayout.widgets.length === 0 ? (
        <div className={classes.empty}>
          <h2>Welcome to Kitchen Display</h2>
          <p>Click "Edit Layout" and add widgets to get started</p>
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
          margin={[16, 16]}
          resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
        >
          {activeLayout.widgets.map(widget => (
            <div key={widget.id} className={classes.widgetContainer}>
              <WidgetWrapper widget={widget} />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}

