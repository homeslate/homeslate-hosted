import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type JSX } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import * as TablerIcons from '@tabler/icons-react';
import { IconMoon, IconSun } from '@tabler/icons-react';
import type { ColorMode, DisplayDocument, StickyNote, ThemeDocument } from '@homeslate/schema';
import { AlarmsProvider, TimersProvider, useTimers } from '@homeslate/widgets';
import {
  BackgroundSlideshow,
  DocumentCanvas,
  patchViewNotes,
  patchWidgetConfig,
  resolveDisplayThemeVars,
  type WidgetRegistryApi,
} from './canvas';
import { AlarmRuntime } from './alarms/AlarmRuntime';
import type { AlarmDefinition } from './alarms/types';
import { coerceAlarms } from './alarms/schedule';
import { HolidayEffects } from './HolidayEffects';
import { createViewRotationClock } from './viewRotationClock';
import classes from './Display.module.css';

const SWIPE_THRESHOLD = 60;
const SWIPE_ANGLE_RATIO = 1.2;

export function Display(props: {
  document: DisplayDocument;
  onChange?: (next: DisplayDocument) => void;
  widgetRegistry?: WidgetRegistryApi;
  previewViewId?: string | null;
  forceRotation?: boolean;
  colorMode?: ColorMode;
  isPreview?: boolean;
}): JSX.Element {
  const {
    document,
    onChange,
    widgetRegistry,
    previewViewId,
    forceRotation = false,
    colorMode,
    isPreview = false,
  } = props;

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [localColorMode, setLocalColorMode] = useState<ColorMode | null>(null);
  const rotationClockRef = useRef(createViewRotationClock());
  const rootRef = useRef<HTMLDivElement>(null);
  const [progressKey, setProgressKey] = useState(0);
  const documentRef = useRef(document);
  // eslint-disable-next-line react-hooks/refs -- keeps the ref current for edits that land in the same tick
  documentRef.current = document;

  const alarms = useMemo(() => coerceAlarms(document.alarms), [document.alarms]);

  const effectiveColorMode: ColorMode =
    localColorMode ?? colorMode ?? document.colorMode ?? 'dark';

  const tokenVars = useMemo(
    () =>
      resolveDisplayThemeVars(
        document.themes as ThemeDocument[],
        document.activeThemeId,
        effectiveColorMode,
      ),
    [document.themes, document.activeThemeId, effectiveColorMode],
  );

  useEffect(() => {
    const visibleViews = document.views.filter((view) => !view.hidden);
    setActiveViewId((prev) => {
      if (previewViewId) {
        const previewView = document.views.find((view) => view.id === previewViewId);
        if (previewView) return previewView.id;
      }
      if (prev && visibleViews.find((view) => view.id === prev)) return prev;
      return visibleViews[0]?.id ?? document.views[0]?.id ?? null;
    });
  }, [document.views, previewViewId]);

  const emit = useCallback(
    (next: DisplayDocument) => {
      documentRef.current = next;
      onChange?.(next);
    },
    [onChange],
  );

  const handleAddNote = useCallback(
    (note: StickyNote) => {
      const viewId = activeViewId;
      if (!viewId) return;
      const current = documentRef.current;
      const notes = current.views.find((view) => view.id === viewId)?.notes ?? [];
      emit(patchViewNotes(current, viewId, [...notes, note]));
    },
    [activeViewId, emit],
  );

  const handleRemoveNote = useCallback(
    (noteId: string) => {
      const viewId = activeViewId;
      if (!viewId) return;
      const current = documentRef.current;
      const notes = current.views.find((view) => view.id === viewId)?.notes ?? [];
      emit(patchViewNotes(current, viewId, notes.filter((note) => note.id !== noteId)));
    },
    [activeViewId, emit],
  );

  const handleUpdateNote = useCallback(
    (noteId: string, updates: Partial<StickyNote>) => {
      const viewId = activeViewId;
      if (!viewId) return;
      const current = documentRef.current;
      const notes = current.views.find((view) => view.id === viewId)?.notes ?? [];
      emit(
        patchViewNotes(
          current,
          viewId,
          notes.map((note) => (note.id === noteId ? { ...note, ...updates } : note)),
        ),
      );
    },
    [activeViewId, emit],
  );

  const handleWidgetConfigChange = useCallback(
    (widgetId: string, config: Record<string, unknown>) => {
      const viewId = activeViewId;
      if (!viewId) return;
      emit(patchWidgetConfig(documentRef.current, viewId, widgetId, config));
    },
    [activeViewId, emit],
  );

  const navigate = useCallback(
    (direction: 'next' | 'prev') => {
      if (previewViewId) return;
      const visibleViews = document.views.filter((view) => !view.hidden);
      if (visibleViews.length <= 1) return;
      setActiveViewId((curr) => {
        const idx = visibleViews.findIndex((view) => view.id === curr);
        const currentIdx = idx === -1 ? 0 : idx;
        const next =
          direction === 'next'
            ? (currentIdx + 1) % visibleViews.length
            : (currentIdx - 1 + visibleViews.length) % visibleViews.length;
        return visibleViews[next].id;
      });
    },
    [document.views, previewViewId],
  );

  const visibleCount = document.views.filter((view) => !view.hidden).length;
  const rotationEnabled = previewViewId ? false : forceRotation || Boolean(document.rotation.enabled);
  const rotationIntervalMs = document.rotation.intervalMs ?? 30_000;
  const navigateRef = useRef(navigate);
  // eslint-disable-next-line react-hooks/refs -- keeps the ref current for edits that land in the same tick
  navigateRef.current = navigate;

  useEffect(() => {
    const clock = rotationClockRef.current;
    clock.sync({
      enabled: rotationEnabled,
      intervalMs: rotationIntervalMs,
      visibleCount,
      onRotate: () => navigateRef.current('next'),
    });
    setProgressKey(clock.getProgressGeneration());
    return () => clock.stop();
  }, [rotationEnabled, rotationIntervalMs, visibleCount]);

  const resetRotation = useCallback(() => {
    const clock = rotationClockRef.current;
    clock.reset({
      enabled: rotationEnabled,
      intervalMs: rotationIntervalMs,
      visibleCount,
      onRotate: () => navigateRef.current('next'),
    });
    setProgressKey(clock.getProgressGeneration());
  }, [rotationEnabled, rotationIntervalMs, visibleCount]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let direction: 'h' | 'v' | null = null;

    const onTouchStart = (e: TouchEvent) => {
      const count = document.views.filter((view) => !view.hidden).length;
      if (count <= 1) return;
      if (previewViewId) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      direction = null;
    };

    const onTouchMove = (e: TouchEvent) => {
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
      if (direction !== 'h') return;
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
  }, [document.views, navigate, previewViewId, resetRotation]);

  const visibleViews = document.views.filter((view) => !view.hidden);
  const showDots = !previewViewId && visibleViews.length > 1;
  const schemaView = document.views.find((view) => view.id === activeViewId);

  return (
    <TimersProvider>
      <AlarmsProvider alarms={alarms} readOnly>
        <div
          ref={rootRef}
          className={classes.root}
          style={tokenVars as CSSProperties}
        >
          {schemaView && <BackgroundSlideshow view={schemaView} />}
          {document.settings.holidayEffectsEnabled && (
            <HolidayEffects previewHolidayId={document.settings.holidayPreviewId} />
          )}
          {schemaView && (
            <DocumentCanvas
              view={schemaView}
              isEditing={false}
              stickyNotesEnabled={document.settings.stickyNotesEnabled}
              widgetRegistry={widgetRegistry}
              onAddNote={handleAddNote}
              onRemoveNote={handleRemoveNote}
              onUpdateNote={handleUpdateNote}
              onWidgetConfigChange={handleWidgetConfigChange}
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
                {visibleViews.map((view) => {
                  const IconComp = view.icon
                    ? (TablerIcons as Record<string, unknown>)[view.icon] as ComponentType<{ size?: number; stroke?: number }> | undefined
                    : undefined;
                  const isActive = view.id === activeViewId;
                  const showProgress = isActive && rotationEnabled;
                  const circumference = 2 * Math.PI * 20;
                  return (
                    <button
                      key={view.id}
                      className={`${classes.iconIndicator} ${isActive ? classes.iconIndicatorActive : ''} ${showProgress ? classes.iconIndicatorWithProgress : ''}`}
                      onClick={() => { setActiveViewId(view.id); resetRotation(); }}
                      aria-label={`Switch to ${view.name}`}
                    >
                      {showProgress && (
                        <svg
                          key={progressKey}
                          className={classes.progressRing}
                          viewBox="0 0 44 44"
                          width="44"
                          height="44"
                          style={{ '--rotation-duration': `${rotationIntervalMs}ms`, '--circumference': circumference } as CSSProperties}
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
          {!isPreview && (
            <AlertRuntimeBridge
              alarms={alarms}
              enabled
              voiceEnabled={document.settings.voiceEnabled ?? false}
            />
          )}
        </div>
      </AlarmsProvider>
    </TimersProvider>
  );
}

function AlertRuntimeBridge(props: {
  alarms: AlarmDefinition[];
  enabled: boolean;
  voiceEnabled: boolean;
}) {
  const { registerEnqueue, restartFromAlert } = useTimers();

  return (
    <AlarmRuntime
      {...props}
      onRegisterEnqueue={registerEnqueue}
      onTimerRestart={restartFromAlert}
    />
  );
}
