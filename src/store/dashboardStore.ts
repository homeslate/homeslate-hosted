import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { DashboardLayout, WidgetDefinition, WidgetConfig } from '../types/widget';
import type { DisplayTheme } from '../types/theme';

export interface Display {
  id: string;        // displays.id (server UUID, primary key)
  displayId: string; // displays.display_id (public polling UUID)
  name: string;
  layouts: DashboardLayout[];
  activeLayoutId: string | null;
  rotationEnabled: boolean;
  rotationIntervalMs: number;
  theme?: DisplayTheme;
}

export interface RemoteDisplay {
  id: string;
  display_id: string;
  name: string;
  config: {
    layouts: DashboardLayout[];
    activeLayoutId: string | null;
    rotationEnabled: boolean;
    rotationIntervalMs: number;
    theme?: DisplayTheme;
  } | null;
}

interface DashboardState {
  displays: Display[];
  selectedDisplayId: string | null;
  selectedViewId: string | null;

  // Sync
  setDisplays: (remoteDisplays: RemoteDisplay[]) => void;
  upsertDisplay: (display: Display) => void;

  // Display CRUD
  addDisplay: (id: string, displayId: string, name: string) => void;
  removeDisplay: (id: string) => void;
  renameDisplay: (id: string, name: string) => void;

  // Navigation
  selectDisplay: (id: string | null) => void;
  selectView: (id: string | null) => void;

  // Per-display settings (act on selectedDisplayId)
  setRotationEnabled: (enabled: boolean) => void;
  setRotationIntervalMs: (ms: number) => void;
  setDisplayTheme: (displayId: string, theme: DisplayTheme) => void;

  // Per-display layout/view actions (act on selectedDisplayId)
  createLayout: (name: string) => void;
  deleteLayout: (id: string) => void;
  renameLayout: (id: string, name: string) => void;
  setActiveLayout: (id: string) => void;
  navigateToView: (direction: 'next' | 'prev') => void;

  // Widget actions (act on selectedDisplayId + selectedViewId)
  addWidget: (type: string, defaultConfig: WidgetConfig, defaultLayout: WidgetDefinition['layout']) => void;
  removeWidget: (widgetId: string) => void;
  updateWidgetConfig: (widgetId: string, config: Partial<WidgetConfig>) => void;
  updateWidgetLayout: (widgetId: string, layout: Partial<WidgetDefinition['layout']>) => void;
  updateAllWidgetLayouts: (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;
}

const createDefaultLayout = (): DashboardLayout => ({
  id: uuidv4(),
  name: 'Main View',
  widgets: [],
  columns: 12,
  rowHeight: 80,
});

function findAvailablePosition(
  widgets: WidgetDefinition[],
  cols: number,
  width: number,
  height: number
): { x: number; y: number } {
  const grid: boolean[][] = [];
  
  for (let y = 0; y < 100; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      grid[y][x] = false;
    }
  }
  
  for (const widget of widgets) {
    const w = widget.layout.w;
    const h = widget.layout.h;
    const x = widget.layout.x;
    const y = widget.layout.y;
    
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (y + dy < 100 && x + dx < cols) {
          grid[y + dy][x + dx] = true;
        }
      }
    }
  }
  
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x <= cols - width; x++) {
      let fits = true;
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          if (grid[y + dy]?.[x + dx]) {
            fits = false;
            break;
          }
        }
        if (!fits) break;
      }
      if (fits) {
        return { x, y };
      }
    }
  }
  
  return { x: 0, y: 0 };
}

const createDefaultDisplay = (name = 'Kitchen Display'): Display => {
  const layout = createDefaultLayout();
  return {
    id: uuidv4(),
    displayId: uuidv4(),
    name,
    layouts: [layout],
    activeLayoutId: layout.id,
    rotationEnabled: false,
    rotationIntervalMs: 30000,
  };
};

// Helper to update a specific display in the array
function updateDisplay(
  displays: Display[],
  id: string,
  updater: (d: Display) => Display
): Display[] {
  return displays.map((d) => (d.id === id ? updater(d) : d));
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      displays: [],
      selectedDisplayId: null,
      selectedViewId: null,

      setDisplays: (remoteDisplays: RemoteDisplay[]) => {
        const { displays } = get();
        const merged: Display[] = remoteDisplays.map((remote) => {
          const existing = displays.find((d) => d.id === remote.id);
          const config = remote.config ?? {
            layouts: [createDefaultLayout()],
            activeLayoutId: null,
            rotationEnabled: false,
            rotationIntervalMs: 30000,
          };
          const layouts = config.layouts.length > 0 ? config.layouts : [createDefaultLayout()];
          const activeLayoutId = config.activeLayoutId ?? layouts[0].id;
          return {
            id: remote.id,
            displayId: remote.display_id,
            name: remote.name,
            layouts,
            activeLayoutId,
            rotationEnabled: config.rotationEnabled ?? existing?.rotationEnabled ?? false,
            rotationIntervalMs: config.rotationIntervalMs ?? existing?.rotationIntervalMs ?? 30000,
            theme: config.theme ?? existing?.theme,
          };
        });
        // Keep selectedDisplayId valid
        const { selectedDisplayId } = get();
        const validSelectedId = merged.find((d) => d.id === selectedDisplayId)
          ? selectedDisplayId
          : null;
        set({ displays: merged, selectedDisplayId: validSelectedId });
      },

      upsertDisplay: (display: Display) => {
        set((state) => {
          const exists = state.displays.find((d) => d.id === display.id);
          if (exists) {
            return { displays: updateDisplay(state.displays, display.id, () => display) };
          }
          return { displays: [...state.displays, display] };
        });
      },

      addDisplay: (id: string, displayId: string, name: string) => {
        const layout = createDefaultLayout();
        const newDisplay: Display = {
          id,
          displayId,
          name,
          layouts: [layout],
          activeLayoutId: layout.id,
          rotationEnabled: false,
          rotationIntervalMs: 30000,
        };
        set((state) => ({ displays: [...state.displays, newDisplay] }));
      },

      removeDisplay: (id: string) => {
        set((state) => {
          const newDisplays = state.displays.filter((d) => d.id !== id);
          return {
            displays: newDisplays,
            selectedDisplayId:
              state.selectedDisplayId === id ? null : state.selectedDisplayId,
            selectedViewId:
              state.selectedDisplayId === id ? null : state.selectedViewId,
          };
        });
      },

      renameDisplay: (id: string, name: string) => {
        set((state) => ({
          displays: updateDisplay(state.displays, id, (d) => ({ ...d, name })),
        }));
      },

      selectDisplay: (id: string | null) => {
        set({ selectedDisplayId: id, selectedViewId: null });
      },

      selectView: (id: string | null) => {
        set({ selectedViewId: id });
      },

      setRotationEnabled: (enabled: boolean) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            rotationEnabled: enabled,
          })),
        }));
      },

      setRotationIntervalMs: (ms: number) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            rotationIntervalMs: ms,
          })),
        }));
      },

      setDisplayTheme: (displayId: string, theme: DisplayTheme) => {
        set((state) => ({
          displays: updateDisplay(state.displays, displayId, (d) => ({ ...d, theme })),
        }));
      },

      createLayout: (name: string) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        const newLayout: DashboardLayout = { ...createDefaultLayout(), name };
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: [...d.layouts, newLayout],
            activeLayoutId: newLayout.id,
          })),
        }));
      },

      deleteLayout: (id: string) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => {
            const newLayouts = d.layouts.filter((l) => l.id !== id);
            const layouts = newLayouts.length > 0 ? newLayouts : [createDefaultLayout()];
            return {
              ...d,
              layouts,
              activeLayoutId:
                d.activeLayoutId === id ? (layouts[0]?.id ?? null) : d.activeLayoutId,
            };
          }),
        }));
      },

      renameLayout: (id: string, name: string) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((l) => (l.id === id ? { ...l, name } : l)),
          })),
        }));
      },

      setActiveLayout: (id: string) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            activeLayoutId: id,
          })),
        }));
      },

      navigateToView: (direction: 'next' | 'prev') => {
        const { selectedDisplayId, displays } = get();
        if (!selectedDisplayId) return;
        const display = displays.find((d) => d.id === selectedDisplayId);
        if (!display || display.layouts.length <= 1) return;
        const idx = display.layouts.findIndex((l) => l.id === display.activeLayoutId);
        if (idx === -1) return;
        const next =
          direction === 'next'
            ? (idx + 1) % display.layouts.length
            : (idx - 1 + display.layouts.length) % display.layouts.length;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            activeLayoutId: d.layouts[next].id,
          })),
        }));
      },

      addWidget: (type: string, defaultConfig: WidgetConfig, defaultLayout: WidgetDefinition['layout']) => {
        const { selectedDisplayId, selectedViewId, displays } = get();
        if (!selectedDisplayId || !selectedViewId) return;
        const display = displays.find((d) => d.id === selectedDisplayId);
        if (!display) return;

        const layout = display.layouts.find((l) => l.id === selectedViewId);
        const cols = layout?.columns ?? 12;
        const existingWidgets = layout?.widgets ?? [];
        
        const pos = findAvailablePosition(existingWidgets, cols, defaultLayout.w, defaultLayout.h);

        const newWidget: WidgetDefinition = {
          id: uuidv4(),
          type,
          title: type.charAt(0).toUpperCase() + type.slice(1),
          config: defaultConfig,
          layout: { ...defaultLayout, x: pos.x, y: pos.y },
        };

        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((layout) =>
              layout.id === selectedViewId
                ? { ...layout, widgets: [...layout.widgets, newWidget] }
                : layout
            ),
          })),
        }));
      },

      removeWidget: (widgetId: string) => {
        const { selectedDisplayId, selectedViewId } = get();
        if (!selectedDisplayId || !selectedViewId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((layout) =>
              layout.id === selectedViewId
                ? { ...layout, widgets: layout.widgets.filter((w) => w.id !== widgetId) }
                : layout
            ),
          })),
        }));
      },

      updateWidgetConfig: (widgetId: string, config: Partial<WidgetConfig>) => {
        const { selectedDisplayId, selectedViewId } = get();
        if (!selectedDisplayId || !selectedViewId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((layout) =>
              layout.id === selectedViewId
                ? {
                    ...layout,
                    widgets: layout.widgets.map((w) =>
                      w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w
                    ),
                  }
                : layout
            ),
          })),
        }));
      },

      updateWidgetLayout: (widgetId: string, layoutUpdate: Partial<WidgetDefinition['layout']>) => {
        const { selectedDisplayId, selectedViewId } = get();
        if (!selectedDisplayId || !selectedViewId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((layout) =>
              layout.id === selectedViewId
                ? {
                    ...layout,
                    widgets: layout.widgets.map((w) =>
                      w.id === widgetId ? { ...w, layout: { ...w.layout, ...layoutUpdate } } : w
                    ),
                  }
                : layout
            ),
          })),
        }));
      },

      updateAllWidgetLayouts: (
        newLayouts: Array<{ i: string; x: number; y: number; w: number; h: number }>
      ) => {
        const { selectedDisplayId, selectedViewId } = get();
        if (!selectedDisplayId || !selectedViewId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((layout) =>
              layout.id === selectedViewId
                ? {
                    ...layout,
                    widgets: layout.widgets.map((w) => {
                      const nl = newLayouts.find((l) => l.i === w.id);
                      if (nl) {
                        return { ...w, layout: { ...w.layout, x: nl.x, y: nl.y, w: nl.w, h: nl.h } };
                      }
                      return w;
                    }),
                  }
                : layout
            ),
          })),
        }));
      },
    }),
    {
      name: 'kitchen-display-storage',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        if (version === 3) return persistedState;
        if (version === 0 || version === 1) {
          // Migrate from old flat shape: {layouts, activeLayoutId, rotationEnabled, rotationIntervalMs, isEditing}
          const old = persistedState as {
            layouts?: DashboardLayout[];
            activeLayoutId?: string | null;
            rotationEnabled?: boolean;
            rotationIntervalMs?: number;
          };
          const layouts = old.layouts ?? [createDefaultLayout()];
          const activeLayoutId = old.activeLayoutId ?? layouts[0]?.id ?? null;
          const migratedDisplay = createDefaultDisplay();
          migratedDisplay.layouts = layouts;
          migratedDisplay.activeLayoutId = activeLayoutId;
          migratedDisplay.rotationEnabled = old.rotationEnabled ?? false;
          migratedDisplay.rotationIntervalMs = old.rotationIntervalMs ?? 30000;
          return {
            displays: [migratedDisplay],
            selectedDisplayId: null,
            selectedViewId: null,
          };
        }
        // v2 → v3: theme field added (optional, no migration needed)
        return persistedState;
      },
    }
  )
);
