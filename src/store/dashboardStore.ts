import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { DashboardLayout, WidgetDefinition, WidgetConfig, StickyNote } from '../types/widget';
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
  passcodeEnabled?: boolean; // whether a viewer passcode is set on the server
  stickyNotesEnabled?: boolean;
}

export interface RemoteDisplay {
  id: string;
  display_id: string;
  name: string;
  passcode_enabled?: boolean;
  config: {
    layouts: DashboardLayout[];
    activeLayoutId: string | null;
    rotationEnabled: boolean;
    rotationIntervalMs: number;
    theme?: DisplayTheme;
    stickyNotesEnabled?: boolean;
  } | null;
}

interface DashboardState {
  displays: Display[];
  selectedDisplayId: string | null;
  selectedViewId: string | null;
  previewDisplayId: string | null; // in-app preview mode (not persisted)

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
  openPreview: (displayId: string) => void;
  closePreview: () => void;

  // Per-display settings (act on selectedDisplayId)
  setRotationEnabled: (enabled: boolean) => void;
  setRotationIntervalMs: (ms: number) => void;
  setDisplayTheme: (displayId: string, theme: DisplayTheme) => void;
  setLayoutBackground: (layoutId: string, updates: { backgroundImage?: string; backgroundImageSize?: 'cover' | 'contain' | 'tile'; backgroundOverlayOpacity?: number }) => void;
  setPasscodeEnabled: (displayId: string, enabled: boolean) => void;
  setStickyNotesEnabled: (displayId: string, enabled: boolean) => void;

  // Per-display layout/view actions (act on selectedDisplayId)
  createLayout: (name: string) => void;
  deleteLayout: (id: string) => void;
  renameLayout: (id: string, name: string) => void;
  reorderLayouts: (orderedIds: string[]) => void;
  toggleLayoutHidden: (id: string) => void;
  setActiveLayout: (id: string) => void;
  navigateToView: (direction: 'next' | 'prev') => void;

  // Widget actions (act on selectedDisplayId + selectedViewId)
  addWidget: (type: string, defaultConfig: WidgetConfig, defaultLayout: WidgetDefinition['layout']) => void;
  removeWidget: (widgetId: string) => void;
  updateWidgetConfig: (widgetId: string, config: Partial<WidgetConfig>) => void;
  updateWidgetLayout: (widgetId: string, layout: Partial<WidgetDefinition['layout']>) => void;
  updateAllWidgetLayouts: (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;

  // Sticky note actions (act on selectedDisplayId)
  addNote: (layoutId: string, note: StickyNote) => void;
  removeNote: (layoutId: string, noteId: string) => void;
  updateNote: (layoutId: string, noteId: string, updates: Partial<StickyNote>) => void;
}

const createDefaultLayout = (): DashboardLayout => ({
  id: uuidv4(),
  name: 'Main View',
  widgets: [],
  columns: 12,
  rowHeight: 80,
});

const GRID_MAX_ROWS = 12;

function findAvailablePosition(
  widgets: WidgetDefinition[],
  cols: number,
  width: number,
  height: number
): { x: number; y: number } {
  const grid: boolean[][] = [];
  
  for (let y = 0; y < GRID_MAX_ROWS; y++) {
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
        if (y + dy < GRID_MAX_ROWS && x + dx < cols) {
          grid[y + dy][x + dx] = true;
        }
      }
    }
  }
  
  for (let y = 0; y <= GRID_MAX_ROWS - height; y++) {
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
      previewDisplayId: null,

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
          
          // Merge widget configs from existing local state to preserve any local-only settings
          const mergedLayouts = layouts.map((layout, idx) => {
            const existingLayout = existing?.layouts?.[idx];
            if (!existingLayout) return layout;
            return {
              ...layout,
              widgets: layout.widgets.map((widget) => {
                const existingWidget = existingLayout.widgets.find((w) => w.id === widget.id);
                if (!existingWidget) return widget;
                return {
                  ...widget,
                  config: { ...widget.config, ...existingWidget.config },
                };
              }),
            };
          });
          
          return {
            id: remote.id,
            displayId: remote.display_id,
            name: remote.name,
            layouts: mergedLayouts,
            activeLayoutId,
            rotationEnabled: config.rotationEnabled ?? existing?.rotationEnabled ?? false,
            rotationIntervalMs: config.rotationIntervalMs ?? existing?.rotationIntervalMs ?? 30000,
            theme: config.theme ?? existing?.theme,
            passcodeEnabled: remote.passcode_enabled ?? existing?.passcodeEnabled ?? false,
            stickyNotesEnabled: config.stickyNotesEnabled ?? existing?.stickyNotesEnabled ?? false,
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

      openPreview: (displayId: string) => {
        set({ previewDisplayId: displayId });
      },

      closePreview: () => {
        set({ previewDisplayId: null });
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

      setLayoutBackground: (layoutId: string, updates: { backgroundImage?: string; backgroundImageSize?: 'cover' | 'contain' | 'tile'; backgroundOverlayOpacity?: number }) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((l) => (l.id === layoutId ? { ...l, ...updates } : l)),
          })),
        }));
      },

      setPasscodeEnabled: (displayId: string, enabled: boolean) => {
        set((state) => ({
          displays: updateDisplay(state.displays, displayId, (d) => ({
            ...d,
            passcodeEnabled: enabled,
          })),
        }));
      },

      setStickyNotesEnabled: (displayId: string, enabled: boolean) => {
        set((state) => ({
          displays: updateDisplay(state.displays, displayId, (d) => ({
            ...d,
            stickyNotesEnabled: enabled,
          })),
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

      reorderLayouts: (orderedIds: string[]) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => {
            const layoutMap = new Map(d.layouts.map((l) => [l.id, l]));
            const reordered = orderedIds
              .map((id) => layoutMap.get(id))
              .filter((l): l is NonNullable<typeof l> => l !== undefined);
            // Append any layouts not in orderedIds (safety net)
            const remaining = d.layouts.filter((l) => !orderedIds.includes(l.id));
            return { ...d, layouts: [...reordered, ...remaining] };
          }),
        }));
      },

      toggleLayoutHidden: (id: string) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((l) => (l.id === id ? { ...l, hidden: !l.hidden } : l)),
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
        if (!display) return;
        const visibleLayouts = display.layouts.filter((l) => !l.hidden);
        if (visibleLayouts.length <= 1) return;
        const idx = visibleLayouts.findIndex((l) => l.id === display.activeLayoutId);
        const currentIdx = idx === -1 ? 0 : idx;
        const next =
          direction === 'next'
            ? (currentIdx + 1) % visibleLayouts.length
            : (currentIdx - 1 + visibleLayouts.length) % visibleLayouts.length;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            activeLayoutId: visibleLayouts[next].id,
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
        set((state) => {
          const newState = {
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
          };
          return newState;
        });
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

      addNote: (layoutId: string, note: StickyNote) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((l) =>
              l.id === layoutId ? { ...l, notes: [...(l.notes ?? []), note] } : l
            ),
          })),
        }));
      },

      removeNote: (layoutId: string, noteId: string) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((l) =>
              l.id === layoutId
                ? { ...l, notes: (l.notes ?? []).filter((n) => n.id !== noteId) }
                : l
            ),
          })),
        }));
      },

      updateNote: (layoutId: string, noteId: string, updates: Partial<StickyNote>) => {
        const { selectedDisplayId } = get();
        if (!selectedDisplayId) return;
        set((state) => ({
          displays: updateDisplay(state.displays, selectedDisplayId, (d) => ({
            ...d,
            layouts: d.layouts.map((l) =>
              l.id === layoutId
                ? {
                    ...l,
                    notes: (l.notes ?? []).map((n) =>
                      n.id === noteId ? { ...n, ...updates } : n
                    ),
                  }
                : l
            ),
          })),
        }));
      },
    }),
    {
      name: 'kitchen-display-storage',
      version: 3,
      partialize: (state) => ({
        displays: state.displays,
        selectedDisplayId: state.selectedDisplayId,
        selectedViewId: state.selectedViewId,
        // previewDisplayId is intentionally excluded — it's ephemeral UI state
      }),
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
