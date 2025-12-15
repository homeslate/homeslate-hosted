import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { DashboardLayout, WidgetDefinition, WidgetConfig } from '../types/widget';

interface DashboardState {
  layouts: DashboardLayout[];
  activeLayoutId: string | null;
  isEditing: boolean;
  
  // Actions
  createLayout: (name: string) => void;
  deleteLayout: (id: string) => void;
  setActiveLayout: (id: string) => void;
  toggleEditing: () => void;
  
  // Widget actions
  addWidget: (type: string, defaultConfig: WidgetConfig, defaultLayout: WidgetDefinition['layout']) => void;
  removeWidget: (widgetId: string) => void;
  updateWidgetConfig: (widgetId: string, config: Partial<WidgetConfig>) => void;
  updateWidgetLayout: (widgetId: string, layout: Partial<WidgetDefinition['layout']>) => void;
  updateAllWidgetLayouts: (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;
}

const createDefaultLayout = (): DashboardLayout => ({
  id: uuidv4(),
  name: 'My Kitchen Display',
  widgets: [],
  columns: 12,
  rowHeight: 80,
});

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layouts: [createDefaultLayout()],
      activeLayoutId: null,
      isEditing: false,

      createLayout: (name: string) => {
        const newLayout: DashboardLayout = {
          ...createDefaultLayout(),
          name,
        };
        set((state) => ({
          layouts: [...state.layouts, newLayout],
          activeLayoutId: newLayout.id,
        }));
      },

      deleteLayout: (id: string) => {
        set((state) => {
          const newLayouts = state.layouts.filter((l) => l.id !== id);
          return {
            layouts: newLayouts.length > 0 ? newLayouts : [createDefaultLayout()],
            activeLayoutId: state.activeLayoutId === id 
              ? (newLayouts[0]?.id ?? null) 
              : state.activeLayoutId,
          };
        });
      },

      setActiveLayout: (id: string) => {
        set({ activeLayoutId: id });
      },

      toggleEditing: () => {
        set((state) => ({ isEditing: !state.isEditing }));
      },

      addWidget: (type: string, defaultConfig: WidgetConfig, defaultLayout: WidgetDefinition['layout']) => {
        const { activeLayoutId, layouts } = get();
        if (!activeLayoutId) return;

        const newWidget: WidgetDefinition = {
          id: uuidv4(),
          type,
          title: type.charAt(0).toUpperCase() + type.slice(1),
          config: defaultConfig,
          layout: {
            ...defaultLayout,
            x: 0,
            y: Infinity, // Places at bottom
          },
        };

        set({
          layouts: layouts.map((layout) =>
            layout.id === activeLayoutId
              ? { ...layout, widgets: [...layout.widgets, newWidget] }
              : layout
          ),
        });
      },

      removeWidget: (widgetId: string) => {
        const { activeLayoutId, layouts } = get();
        if (!activeLayoutId) return;

        set({
          layouts: layouts.map((layout) =>
            layout.id === activeLayoutId
              ? { ...layout, widgets: layout.widgets.filter((w) => w.id !== widgetId) }
              : layout
          ),
        });
      },

      updateWidgetConfig: (widgetId: string, config: Partial<WidgetConfig>) => {
        const { activeLayoutId, layouts } = get();
        if (!activeLayoutId) return;

        set({
          layouts: layouts.map((layout) =>
            layout.id === activeLayoutId
              ? {
                  ...layout,
                  widgets: layout.widgets.map((w) =>
                    w.id === widgetId
                      ? { ...w, config: { ...w.config, ...config } }
                      : w
                  ),
                }
              : layout
          ),
        });
      },

      updateWidgetLayout: (widgetId: string, layoutUpdate: Partial<WidgetDefinition['layout']>) => {
        const { activeLayoutId, layouts } = get();
        if (!activeLayoutId) return;

        set({
          layouts: layouts.map((layout) =>
            layout.id === activeLayoutId
              ? {
                  ...layout,
                  widgets: layout.widgets.map((w) =>
                    w.id === widgetId
                      ? { ...w, layout: { ...w.layout, ...layoutUpdate } }
                      : w
                  ),
                }
              : layout
          ),
        });
      },

      updateAllWidgetLayouts: (newLayouts) => {
        const { activeLayoutId, layouts } = get();
        if (!activeLayoutId) return;

        set({
          layouts: layouts.map((layout) =>
            layout.id === activeLayoutId
              ? {
                  ...layout,
                  widgets: layout.widgets.map((w) => {
                    const newLayout = newLayouts.find((l) => l.i === w.id);
                    if (newLayout) {
                      return {
                        ...w,
                        layout: {
                          ...w.layout,
                          x: newLayout.x,
                          y: newLayout.y,
                          w: newLayout.w,
                          h: newLayout.h,
                        },
                      };
                    }
                    return w;
                  }),
                }
              : layout
          ),
        });
      },
    }),
    {
      name: 'kitchen-display-storage',
    }
  )
);

// Initialize active layout if not set
const state = useDashboardStore.getState();
if (!state.activeLayoutId && state.layouts.length > 0) {
  useDashboardStore.setState({ activeLayoutId: state.layouts[0].id });
}

