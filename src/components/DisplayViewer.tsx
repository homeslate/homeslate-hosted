import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { PinInput, Stack, Text, Button } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useWakeLock } from '../hooks/useWakeLock';
import { DisplayProvider } from '../contexts/DisplayContext';
import { HostGoogleRuntime } from '../host/HostGoogleRuntime';
import type { DashboardLayout, StickyNote } from '../types/widget';
import type { TodoItem } from '@homeslate/widgets';
import type { ColorMode, ThemeDocument } from '../types/theme';
import type { HolidayId } from '../holidays/registry';
import { apiClient } from '../services/apiClient';
import type { NotesPatchRequest, TodosPatchRequest } from '../types/api';
import type { AlarmDefinition } from '../alarms/types';
import { Display } from '@homeslate/display';
import { displayRecordToDocument } from '../displayDocumentBridge';
import type { DisplayDocument } from '@homeslate/schema';
import classes from './DisplayViewer.module.css';

interface DisplayConfig {
  layouts: DashboardLayout[];
  activeLayoutId: string | null;
  rotationEnabled: boolean;
  rotationIntervalMs: number;
  themes?: ThemeDocument[];
  activeThemeId?: string | null;
  colorMode?: ColorMode;
  stickyNotesEnabled?: boolean;
  voiceEnabled?: boolean;
  holidayEffectsEnabled?: boolean;
  holidayPreviewId?: HolidayId;
  alarms?: AlarmDefinition[];
}

interface Props {
  displayId: string;
  isPreview?: boolean;
  previewLayoutId?: string;
  forceRotation?: boolean;
  colorMode?: ColorMode;
}

const POLL_INTERVAL_MS = 30_000;

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function DisplayViewer({
  displayId,
  isPreview = false,
  previewLayoutId,
  forceRotation = false,
  colorMode,
}: Props) {
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  const [passcodeRequired, setPasscodeRequired] = useState(false);
  const [passcode, setPasscode] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinVerifying, setPinVerifying] = useState(false);

  const [viewerNotesByLayout, setViewerNotesByLayout] = useState<Record<string, StickyNote[]>>({});
  const pendingWrite = useRef<Record<string, boolean>>({});
  const writeDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [viewerTodoItemsByKey, setViewerTodoItemsByKey] = useState<Record<string, TodoItem[]>>({});
  const pendingTodoWrite = useRef<Record<string, boolean>>({});
  const todoWriteDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useWakeLock();

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
            const doc = displayRecordToDocument(cfg);
            setViewerNotesByLayout((prev) => {
              const next = { ...prev };
              for (const view of doc.views) {
                if (!pendingWrite.current[view.id]) {
                  next[view.id] = (view.notes ?? []) as StickyNote[];
                }
              }
              return next;
            });
            setViewerTodoItemsByKey((prev) => {
              const next = { ...prev };
              for (const view of doc.views) {
                for (const widget of view.widgets ?? []) {
                  if (widget.type === 'todo' && widget.config?.items) {
                    const key = `${view.id}:${widget.id}`;
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
  }, [displayId, passcode]);

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

  const schemaDocument = useMemo(
    () => (config ? displayRecordToDocument(config) : null),
    [config],
  );

  const mergedDocument = useMemo(() => {
    if (!schemaDocument) return null;
    return {
      ...schemaDocument,
      views: schemaDocument.views.map((view) => ({
        ...view,
        notes: viewerNotesByLayout[view.id] ?? view.notes,
        widgets: view.widgets.map((widget) => {
          if (widget.type !== 'todo') return widget;
          const key = `${view.id}:${widget.id}`;
          const override = viewerTodoItemsByKey[key];
          if (!override) return widget;
          return {
            ...widget,
            config: { ...widget.config, items: override },
          };
        }),
      })),
    };
  }, [schemaDocument, viewerNotesByLayout, viewerTodoItemsByKey]);

  const lastDocumentRef = useRef<DisplayDocument | null>(null);
  // eslint-disable-next-line react-hooks/refs -- keeps the ref current for edits that land in the same tick
  lastDocumentRef.current = mergedDocument;

  const handleDocumentChange = useCallback(
    (next: DisplayDocument) => {
      const prev = lastDocumentRef.current;
      lastDocumentRef.current = next;

      for (const view of next.views) {
        const prevView = prev?.views.find((candidate) => candidate.id === view.id);
        const nextNotes = (view.notes ?? []) as StickyNote[];
        const prevNotes = (prevView?.notes ?? []) as StickyNote[];
        if (!sameJson(nextNotes, prevNotes)) {
          pendingWrite.current[view.id] = true;
          setViewerNotesByLayout((current) => ({ ...current, [view.id]: nextNotes }));
          writeNotes(view.id, nextNotes);
        }

        for (const widget of view.widgets) {
          if (widget.type !== 'todo') continue;
          const prevWidget = prevView?.widgets.find((candidate) => candidate.id === widget.id);
          const nextItems = widget.config.items as TodoItem[] | undefined;
          const prevItems = prevWidget?.config.items as TodoItem[] | undefined;
          if (nextItems && !sameJson(nextItems, prevItems)) {
            const key = `${view.id}:${widget.id}`;
            pendingTodoWrite.current[key] = true;
            setViewerTodoItemsByKey((current) => ({ ...current, [key]: nextItems }));
            writeTodos(view.id, widget.id, nextItems);
          }
        }
      }
    },
    [writeNotes, writeTodos],
  );

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

  return (
    <DisplayProvider displayId={displayId} isPreview={isPreview}>
      <HostGoogleRuntime>
        {mergedDocument ? (
          <Display
            key={displayId}
            document={mergedDocument}
            onChange={handleDocumentChange}
            isPreview={isPreview}
            previewViewId={previewLayoutId}
            forceRotation={forceRotation}
            colorMode={colorMode}
          />
        ) : null}
      </HostGoogleRuntime>
    </DisplayProvider>
  );
}
