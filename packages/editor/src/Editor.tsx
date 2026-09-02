import { useCallback, useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode } from 'react';
import { Group, Button, Modal, Stack } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import type { DisplayDocument, StickyNote, ThemeDocument, ViewBackground } from '@homeslate/schema';
import { AlarmsProvider, TimersProvider, getWidgetByType, getWidgetTypes } from '@homeslate/widgets';
import {
  BackgroundSlideshow,
  DocumentCanvas,
  applyWidgetLayouts,
  patchView,
  patchViewNotes,
  patchWidgetConfig,
  removeWidget,
  resolveDisplayThemeVars,
  type WidgetRegistryApi,
} from '@homeslate/display/canvas';
import { BgSettings, WidgetPanel } from './WidgetPanel';
import classes from './Editor.module.css';

const DEFAULT_WIDGET_REGISTRY: WidgetRegistryApi = { getWidgetByType, getWidgetTypes };

export type EditorProps = {
  document: DisplayDocument;
  onChange?: (next: DisplayDocument) => void;
  viewId: string;
  widgetRegistry?: WidgetRegistryApi;
  onUploadBackgroundPhoto?: (payload: {
    dataUrl?: string;
    url?: string;
    filename?: string;
  }) => Promise<{ key: string; filename: string }>;
  actions?: ReactNode;
};

export function Editor(props: EditorProps): JSX.Element {
  const {
    document,
    onChange,
    viewId,
    widgetRegistry = DEFAULT_WIDGET_REGISTRY,
    onUploadBackgroundPhoto,
    actions,
  } = props;
  const [bgSettingsOpen, setBgSettingsOpen] = useState(false);
  const documentRef = useRef(document);
  // eslint-disable-next-line react-hooks/refs -- keeps the ref current for edits that land in the same tick
  documentRef.current = document;

  const view = document.views.find((item) => item.id === viewId);

  const tokenVars = useMemo(
    () =>
      resolveDisplayThemeVars(
        document.themes as ThemeDocument[],
        document.activeThemeId,
        document.colorMode ?? 'dark',
      ),
    [document.themes, document.activeThemeId, document.colorMode],
  );

  const emit = useCallback(
    (next: DisplayDocument) => {
      documentRef.current = next;
      onChange?.(next);
    },
    [onChange],
  );

  const updateBg = useCallback(
    (patch: Partial<ViewBackground>) => {
      const current = documentRef.current;
      const currentView = current.views.find((item) => item.id === viewId);
      if (!currentView) return;
      emit(
        patchView(current, viewId, {
          background: { ...currentView.background, ...patch },
        }),
      );
    },
    [emit, viewId],
  );

  const handleLayoutChange = useCallback(
    (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
      emit(applyWidgetLayouts(documentRef.current, viewId, layouts));
    },
    [emit, viewId],
  );

  const handleWidgetConfigChange = useCallback(
    (widgetId: string, config: Record<string, unknown>) => {
      emit(patchWidgetConfig(documentRef.current, viewId, widgetId, config));
    },
    [emit, viewId],
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      emit(removeWidget(documentRef.current, viewId, widgetId));
    },
    [emit, viewId],
  );

  const handleAddNote = useCallback(
    (note: StickyNote) => {
      const current = documentRef.current;
      const notes = current.views.find((item) => item.id === viewId)?.notes ?? [];
      emit(patchViewNotes(current, viewId, [...notes, note]));
    },
    [emit, viewId],
  );

  const handleRemoveNote = useCallback(
    (noteId: string) => {
      const current = documentRef.current;
      const notes = current.views.find((item) => item.id === viewId)?.notes ?? [];
      emit(patchViewNotes(current, viewId, notes.filter((note) => note.id !== noteId)));
    },
    [emit, viewId],
  );

  const handleUpdateNote = useCallback(
    (noteId: string, updates: Partial<StickyNote>) => {
      const current = documentRef.current;
      const notes = current.views.find((item) => item.id === viewId)?.notes ?? [];
      emit(
        patchViewNotes(
          current,
          viewId,
          notes.map((note) => (note.id === noteId ? { ...note, ...updates } : note)),
        ),
      );
    },
    [emit, viewId],
  );

  return (
    <div className={classes.root} style={tokenVars as CSSProperties}>
      <div className={classes.pageActions}>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconSettings size={16} />}
            onClick={() => setBgSettingsOpen(true)}
          >
            Background Settings
          </Button>
          {actions}
        </Group>
      </div>

      <div className={classes.body}>
        <WidgetPanel
          document={document}
          viewId={viewId}
          onChange={emit}
          widgetRegistry={widgetRegistry}
        />
        <main className={classes.main} style={tokenVars as CSSProperties}>
          {view && <BackgroundSlideshow view={view} />}
          <TimersProvider>
            <AlarmsProvider
              alarms={document.alarms ?? []}
              onAlarmsChange={(next) => emit({ ...documentRef.current, alarms: next })}
            >
              {view && (
                <DocumentCanvas
                  view={view}
                  isEditing
                  stickyNotesEnabled={document.settings.stickyNotesEnabled ?? false}
                  widgetRegistry={widgetRegistry}
                  onLayoutChange={handleLayoutChange}
                  onWidgetConfigChange={handleWidgetConfigChange}
                  onRemoveWidget={handleRemoveWidget}
                  onAddNote={handleAddNote}
                  onRemoveNote={handleRemoveNote}
                  onUpdateNote={handleUpdateNote}
                />
              )}
            </AlarmsProvider>
          </TimersProvider>
        </main>
      </div>
      <Modal
        opened={bgSettingsOpen}
        onClose={() => setBgSettingsOpen(false)}
        title="View Background"
        size="md"
      >
        <Stack gap="md">
          {view && (
            <BgSettings
              view={view}
              updateBg={updateBg}
              onUploadBackgroundPhoto={onUploadBackgroundPhoto}
            />
          )}
          <Button onClick={() => setBgSettingsOpen(false)}>Done</Button>
        </Stack>
      </Modal>
    </div>
  );
}
