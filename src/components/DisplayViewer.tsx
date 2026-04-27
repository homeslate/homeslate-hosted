import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { PinInput, Stack, Text, Button, ActionIcon, Tooltip } from '@mantine/core';
import * as TablerIcons from '@tabler/icons-react';
import { IconLock, IconSun, IconMoon } from '@tabler/icons-react';
import { useWakeLock } from '../hooks/useWakeLock';
import { DisplayProvider } from '../contexts/DisplayContext';
import type { DashboardLayout, StickyNote, WidgetDefinition } from '../types/widget';
import type { TodoItem } from '../widgets/TodoWidget';
import type { ColorMode, ThemeDocument } from '../types/theme';
import type { HolidayId } from '../holidays/registry';
import { resolveTheme, themeToVars, pickActiveDocument } from '../themes';
import { apiClient } from '../services/apiClient';
import type { NotesPatchRequest, TodosPatchRequest } from '../types/api';
import { BackgroundSlideshow } from './BackgroundSlideshow';
import { Dashboard } from './Dashboard';
import { HolidayEffects } from './HolidayEffects';
import classes from './DisplayViewer.module.css';

const SWIPE_THRESHOLD = 60;
const SWIPE_ANGLE_RATIO = 1.2;

interface DisplayConfig {
  layouts: DashboardLayout[];
  activeLayoutId: string | null;
  rotationEnabled: boolean;
  rotationIntervalMs: number;
  themes?: ThemeDocument[];
  activeThemeId?: string | null;
  colorMode?: ColorMode;
  stickyNotesEnabled?: boolean;
  holidayEffectsEnabled?: boolean;
  holidayPreviewId?: HolidayId;
}

interface Props {
  displayId: string;
  isPreview?: boolean;
  previewLayoutId?: string;
  forceRotation?: boolean;
  colorMode?: ColorMode;
}

const POLL_INTERVAL_MS = 30_000;

export function DisplayViewer({
  displayId,
  isPreview = false,
  previewLayoutId,
  forceRotation = false,
  colorMode,
}: Props) {
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [localColorMode, setLocalColorMode] = useState<ColorMode | null>(null);
  const [passcodeRequired, setPasscodeRequired] = useState(false);
  const [passcode, setPasscode] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinVerifying, setPinVerifying] = useState(false);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [progressKey, setProgressKey] = useState(0);

  const [viewerNotesByLayout, setViewerNotesByLayout] = useState<Record<string, StickyNote[]>>({});
  const pendingWrite = useRef<Record<string, boolean>>({});
  const writeDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [viewerTodoItemsByKey, setViewerTodoItemsByKey] = useState<Record<string, TodoItem[]>>({});
  const pendingTodoWrite = useRef<Record<string, boolean>>({});
  const todoWriteDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useWakeLock();

  const tokenVars = useMemo(() => {
    const themes = config?.themes;
    if (!themes?.length) {
      return {};
    }
    const themeDoc = pickActiveDocument(themes, config?.activeThemeId ?? null);
    const effectiveMode = localColorMode ?? colorMode ?? config?.colorMode ?? 'dark';
    const resolvedTheme = resolveTheme(themeDoc, effectiveMode);
    return themeToVars(resolvedTheme);
  }, [config, colorMode, localColorMode]);

  useEffect(() => {
    const load = () => {
      apiClient
        .get<{ config?: DisplayConfig | null; passcodeRequired?: boolean }>('/api/display', {
          query: { id: displayId, passcode: passcode ?? undefined },
          cache: 'no-store',
        })
        .then((data: { config?: DisplayConfig | null; passcodeRequired?: boolean }) => {
          setPinVerifying(false);
          if (data.passcodeRequired) {
            if (passcode !== null) setPinError(true);
            setPasscodeRequired(true);
            setPasscode(null);
            setConfig(null);
            return;
          }
          setPinError(false);
          setPasscodeRequired(false);
          const cfg = data.config ?? null;
          if (cfg) {
            setConfig(cfg);
            const visibleLayouts = cfg.layouts.filter((l) => !l.hidden);
            setActiveLayoutId((prev) => {
              if (previewLayoutId) {
                const previewLayout = cfg.layouts.find((l) => l.id === previewLayoutId);
                if (previewLayout) return previewLayout.id;
              }
              if (prev && visibleLayouts.find((l) => l.id === prev)) return prev;
              return visibleLayouts[0]?.id ?? cfg.layouts[0]?.id ?? null;
            });
            setViewerNotesByLayout((prev) => {
              const next = { ...prev };
              for (const layout of cfg.layouts) {
                if (!pendingWrite.current[layout.id]) {
                  next[layout.id] = layout.notes ?? [];
                }
              }
              return next;
            });
            setViewerTodoItemsByKey((prev) => {
              const next = { ...prev };
              for (const layout of cfg.layouts) {
                for (const widget of layout.widgets ?? []) {
                  if (widget.type === 'todo' && widget.config?.items) {
                    const key = `${layout.id}:${widget.id}`;
                    if (!pendingTodoWrite.current[key]) {
                      next[key] = widget.config.items as TodoItem[];
                    }
                  }
                }
              }
              return next;
            });
          }
        })
        .catch(console.error);
    };
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [displayId, passcode, previewLayoutId]);

  const writeNotes = useCallback(
    (layoutId: string, notes: StickyNote[]) => {
      if (writeDebounceRef.current[layoutId]) clearTimeout(writeDebounceRef.current[layoutId]);
      writeDebounceRef.current[layoutId] = setTimeout(() => {
        apiClient.patch<unknown, NotesPatchRequest>('/api/notes', {
          query: { publicDisplayId: displayId, layoutId },
          body: { notes },
        })
          .catch(console.error)
          .finally(() => {
            pendingWrite.current[layoutId] = false;
          });
      }, 1000);
    },
    [displayId]
  );

  const handleAddNote = useCallback(
    (note: StickyNote) => {
      const lid = activeLayoutId;
      if (!lid) return;
      setViewerNotesByLayout((prev) => {
        const current = prev[lid] ?? [];
        const updated = [...current, note];
        pendingWrite.current[lid] = true;
        writeNotes(lid, updated);
        return { ...prev, [lid]: updated };
      });
    },
    [activeLayoutId, writeNotes]
  );

  const handleRemoveNote = useCallback(
    (noteId: string) => {
      const lid = activeLayoutId;
      if (!lid) return;
      setViewerNotesByLayout((prev) => {
        const current = prev[lid] ?? [];
        const updated = current.filter((n) => n.id !== noteId);
        pendingWrite.current[lid] = true;
        writeNotes(lid, updated);
        return { ...prev, [lid]: updated };
      });
    },
    [activeLayoutId, writeNotes]
  );

  const handleUpdateNote = useCallback(
    (noteId: string, updates: Partial<StickyNote>) => {
      const lid = activeLayoutId;
      if (!lid) return;
      setViewerNotesByLayout((prev) => {
        const current = prev[lid] ?? [];
        const updated = current.map((n) => (n.id === noteId ? { ...n, ...updates } : n));
        pendingWrite.current[lid] = true;
        writeNotes(lid, updated);
        return { ...prev, [lid]: updated };
      });
    },
    [activeLayoutId, writeNotes]
  );

  const writeTodos = useCallback(
    (layoutId: string, widgetId: string, items: TodoItem[]) => {
      const key = `${layoutId}:${widgetId}`;
      if (todoWriteDebounceRef.current[key]) clearTimeout(todoWriteDebounceRef.current[key]);
      todoWriteDebounceRef.current[key] = setTimeout(() => {
        apiClient.patch<unknown, TodosPatchRequest>('/api/todos', {
          query: { publicDisplayId: displayId, layoutId, widgetId },
          body: { items },
        })
          .catch(console.error)
          .finally(() => {
            pendingTodoWrite.current[key] = false;
          });
      }, 500);
    },
    [displayId]
  );

  const handleTodoWidgetChange = useCallback(
    (widgetId: string, config: Record<string, unknown>) => {
      const lid = activeLayoutId;
      if (!lid || !config.items) return;
      const key = `${lid}:${widgetId}`;
      const items = config.items as TodoItem[];
      setViewerTodoItemsByKey((prev) => {
        pendingTodoWrite.current[key] = true;
        writeTodos(lid, widgetId, items);
        return { ...prev, [key]: items };
      });
    },
    [activeLayoutId, writeTodos]
  );

  const layoutList = config?.layouts;
  const mergedLayouts = useMemo(() => {
    if (!layoutList) return [];
    return layoutList.map((layout) => ({
      ...layout,
      widgets: (layout.widgets ?? []).map((widget) => {
        if (widget.type !== 'todo') return widget;
        const key = `${layout.id}:${widget.id}`;
        const override = viewerTodoItemsByKey[key];
        if (!override) return widget;
        return {
          ...widget,
          config: { ...widget.config, items: override },
        } as WidgetDefinition;
      }),
    }));
  }, [layoutList, viewerTodoItemsByKey]);

  const navigate = useCallback((direction: 'next' | 'prev') => {
    if (!config) return;
    if (previewLayoutId) return;
    const visibleLayouts = config.layouts.filter((l) => !l.hidden);
    if (visibleLayouts.length <= 1) return;
    setActiveLayoutId((curr) => {
      const idx = visibleLayouts.findIndex((l) => l.id === curr);
      const currentIdx = idx === -1 ? 0 : idx;
      const next =
        direction === 'next'
          ? (currentIdx + 1) % visibleLayouts.length
          : (currentIdx - 1 + visibleLayouts.length) % visibleLayouts.length;
      return visibleLayouts[next].id;
    });
  }, [config, previewLayoutId]);

  const visibleCount = config?.layouts.filter((l) => !l.hidden).length ?? 0;
  const rotationEnabled = previewLayoutId
    ? false
    : (forceRotation || Boolean(config?.rotationEnabled));
  const rotationIntervalMs = config?.rotationIntervalMs ?? 30_000;

  useEffect(() => {
    if (rotationRef.current) clearInterval(rotationRef.current);
    if (rotationEnabled && visibleCount > 1) {
      rotationRef.current = setInterval(() => navigate('next'), rotationIntervalMs);
      setProgressKey((k) => k + 1);
    }
    return () => {
      if (rotationRef.current) clearInterval(rotationRef.current);
    };
  }, [navigate, rotationEnabled, rotationIntervalMs, visibleCount]);

  const resetRotation = useCallback(() => {
    if (rotationRef.current) clearInterval(rotationRef.current);
    const visibleLayouts = config?.layouts.filter((l) => !l.hidden) ?? [];
    if (rotationEnabled && visibleLayouts.length > 1) {
      rotationRef.current = setInterval(() => navigate('next'), rotationIntervalMs);
      setProgressKey((k) => k + 1);
    }
  }, [config, navigate, rotationEnabled, rotationIntervalMs]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let direction: 'h' | 'v' | null = null;

    const onTouchStart = (e: TouchEvent) => {
      const visibleCount = config?.layouts.filter((l) => !l.hidden).length ?? 0;
      if (!config || visibleCount <= 1) return;
      if (previewLayoutId) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      direction = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!config) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (direction === null) {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          direction = Math.abs(dx) > Math.abs(dy) * SWIPE_ANGLE_RATIO ? 'h' : 'v';
        }
      }

      if (direction === 'h') {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!config || direction !== 'h') return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * SWIPE_ANGLE_RATIO) {
        navigate(dx < 0 ? 'next' : 'prev');
        resetRotation();
      }
      direction = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [config, navigate, previewLayoutId, resetRotation]);

  if (passcodeRequired) {
    const handleSubmit = (pin: string) => {
      if (pin.length === 4) {
        setPinVerifying(true);
        setPinError(false);
        setPasscode(pin);
        setPinInput('');
      }
    };

    return (
      <div className={classes.pinScreen}>
        <Stack align="center" gap="lg">
          <IconLock size={40} opacity={0.7} />
          <Text size="xl" fw={600}>Enter Display PIN</Text>
          <PinInput
            length={4}
            type="number"
            value={pinInput}
            onChange={(val) => {
              setPinInput(val);
              setPinError(false);
            }}
            onComplete={(val) => handleSubmit(val)}
            error={pinError}
            placeholder="·"
            size="xl"
            autoFocus
          />
          {pinError && (
            <Text size="sm" c="red">Incorrect PIN. Please try again.</Text>
          )}
          <Button
            onClick={() => handleSubmit(pinInput)}
            disabled={pinInput.length !== 4 || pinVerifying}
            loading={pinVerifying}
          >
            Unlock
          </Button>
        </Stack>
      </div>
    );
  }

  const allLayouts = config?.layouts ?? [];
  const layouts = allLayouts.filter((l) => !l.hidden);
  const showDots = !previewLayoutId && layouts.length > 1;

  const effectiveColorMode: ColorMode =
    localColorMode ?? colorMode ?? config?.colorMode ?? 'dark';
  const activeLayout = config?.layouts.find((l) => l.id === activeLayoutId);

  return (
    <DisplayProvider displayId={displayId} isPreview={isPreview}>
      <div
        ref={rootRef}
        className={classes.root}
        style={tokenVars as React.CSSProperties}
      >
        {activeLayout && <BackgroundSlideshow layout={activeLayout} />}
        {config?.holidayEffectsEnabled && (
          <HolidayEffects previewHolidayId={config.holidayPreviewId} />
        )}
        {config && (
          <ViewerDashboard
            layouts={mergedLayouts}
            activeLayoutId={activeLayoutId}
            stickyNotesEnabled={config.stickyNotesEnabled}
            notesOverride={activeLayoutId ? viewerNotesByLayout[activeLayoutId] : undefined}
            onAddNote={handleAddNote}
            onRemoveNote={handleRemoveNote}
            onUpdateNote={handleUpdateNote}
            onWidgetConfigChange={handleTodoWidgetChange}
          />
        )}
        {showDots && (
          <>
            <button
              className={classes.navPrev}
              onClick={() => { navigate('prev'); resetRotation(); }}
              aria-label="Previous view"
            />
            <button
              className={classes.navNext}
              onClick={() => { navigate('next'); resetRotation(); }}
              aria-label="Next view"
            />
            <div className={classes.dots}>
              {layouts.map((l) => {
                const IconComp = l.icon
                  ? (TablerIcons as Record<string, unknown>)[l.icon] as React.ComponentType<{ size?: number; stroke?: number }> | undefined
                  : undefined;
                const isActive = l.id === activeLayoutId;
                const showProgress = isActive && rotationEnabled;
                const circumference = 2 * Math.PI * 20;
                return (
                  <button
                    key={l.id}
                    className={`${classes.iconIndicator} ${isActive ? classes.iconIndicatorActive : ''} ${showProgress ? classes.iconIndicatorWithProgress : ''}`}
                    onClick={() => { setActiveLayoutId(l.id); resetRotation(); }}
                    aria-label={`Switch to ${l.name}`}
                  >
                    {showProgress && (
                      <svg
                        key={progressKey}
                        className={classes.progressRing}
                        viewBox="0 0 44 44"
                        width="44"
                        height="44"
                        style={{ '--rotation-duration': `${rotationIntervalMs}ms`, '--circumference': circumference } as React.CSSProperties}
                      >
                        <circle
                          className={classes.progressRingFill}
                          cx="22"
                          cy="22"
                          r="20"
                          fill="none"
                          strokeWidth="2"
                        />
                      </svg>
                    )}
                    {IconComp ? (
                      <IconComp size={20} stroke={isActive ? 2 : 1.5} />
                    ) : (
                      <span className={classes.iconPlaceholder} aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {config && (
          <div className={classes.colorModeToggle}>
            <Tooltip
              label={effectiveColorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              position="left"
              withArrow
            >
              <ActionIcon
                variant="subtle"
                size="md"
                className={classes.colorModeBtn}
                onClick={() => setLocalColorMode(effectiveColorMode === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle light/dark mode"
              >
                {effectiveColorMode === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
              </ActionIcon>
            </Tooltip>
          </div>
        )}
      </div>
    </DisplayProvider>
  );
}

function ViewerDashboard({
  layouts,
  activeLayoutId,
  stickyNotesEnabled,
  notesOverride,
  onAddNote,
  onRemoveNote,
  onUpdateNote,
  onWidgetConfigChange,
}: {
  layouts: DashboardLayout[];
  activeLayoutId: string | null;
  stickyNotesEnabled?: boolean;
  notesOverride?: StickyNote[];
  onAddNote?: (note: StickyNote) => void;
  onRemoveNote?: (noteId: string) => void;
  onUpdateNote?: (noteId: string, updates: Partial<StickyNote>) => void;
  onWidgetConfigChange?: (widgetId: string, config: Record<string, unknown>) => void;
}) {
  return (
    <Dashboard
      layoutId={activeLayoutId ?? undefined}
      isEditing={false}
      externalLayouts={layouts}
      stickyNotesEnabled={stickyNotesEnabled}
      notesOverride={notesOverride}
      onAddNote={onAddNote}
      onRemoveNote={onRemoveNote}
      onUpdateNote={onUpdateNote}
      onWidgetConfigChange={onWidgetConfigChange}
    />
  );
}