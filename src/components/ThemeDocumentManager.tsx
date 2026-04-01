import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconEdit,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import type { ColorMode } from '../types/theme';
import type { ThemeDocument, ThemeValidationIssue } from '../themes/themeDocumentValidation';
import { validateThemeDocument } from '../themes/themeDocumentValidation';
import { themeDocumentToPreviewVars } from '../themes/themeDocumentPreview';
import { createThemeDocumentFromPreset, getPresetById, THEME_PRESET_OPTIONS } from '../themes/themeDocumentPresets';
import classes from './ThemeDocumentManager.module.css';

interface ThemeDocumentManagerProps {
  documents: ThemeDocument[] | undefined;
  activeThemeDocumentId: string | null | undefined;
  onChange: (documents: ThemeDocument[], activeThemeDocumentId: string | null) => void;
}

function withActiveFlags(documents: ThemeDocument[], activeThemeDocumentId: string | null): ThemeDocument[] {
  return documents.map((doc) => ({
    ...doc,
    isActive: activeThemeDocumentId !== null && doc.id === activeThemeDocumentId,
  }));
}

function uniqueId(base: string, existingIds: Set<string>): string {
  if (!existingIds.has(base)) return base;
  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function formatIssues(issues: ThemeValidationIssue[]): string {
  return issues.slice(0, 8).map((issue) => `${issue.path}: ${issue.message}`).join('\n');
}

export function ThemeDocumentManager({ documents, activeThemeDocumentId, onChange }: ThemeDocumentManagerProps) {
  const themeDocuments = documents ?? [];

  /** Row highlight in the library (which theme actions apply to). */
  const [libraryFocusId, setLibraryFocusId] = useState<string | null>(themeDocuments[0]?.id ?? null);
  /** When set, the JSON + preview workspace is open for this theme id. */
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);

  const [editorValue, setEditorValue] = useState('');
  const [themeName, setThemeName] = useState('Custom Theme');
  const [presetId, setPresetId] = useState<string>(THEME_PRESET_OPTIONS[0]?.value ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<ColorMode>('dark');

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const editingTheme = useMemo(
    () => (editingThemeId ? themeDocuments.find((doc) => doc.id === editingThemeId) ?? null : null),
    [themeDocuments, editingThemeId]
  );

  const savedJsonForEditing = useMemo(() => {
    if (!editingTheme) return '';
    return JSON.stringify(editingTheme, null, 2);
  }, [editingTheme]);

  const isDirty = Boolean(editingThemeId && editorValue !== savedJsonForEditing);

  useEffect(() => {
    if (!libraryFocusId && themeDocuments[0]) {
      setLibraryFocusId(themeDocuments[0].id);
      return;
    }
    if (libraryFocusId && !themeDocuments.some((doc) => doc.id === libraryFocusId)) {
      setLibraryFocusId(themeDocuments[0]?.id ?? null);
    }
  }, [libraryFocusId, themeDocuments]);

  /** Load editor when entering edit mode for a theme. */
  useEffect(() => {
    if (!editingThemeId) {
      setEditorValue('');
      return;
    }
    const doc = themeDocuments.find((d) => d.id === editingThemeId);
    if (doc) {
      setEditorValue(JSON.stringify(doc, null, 2));
    }
  }, [editingThemeId]); // eslint-disable-line react-hooks/exhaustive-deps -- only reset buffer when switching edit target

  const previewResult = useMemo(() => {
    if (!editingThemeId || !editorValue.trim()) {
      return { status: 'empty' as const };
    }
    try {
      const parsed: unknown = JSON.parse(editorValue);
      const validation = validateThemeDocument(parsed);
      if (!validation.ok || !validation.data) {
        return { status: 'invalid' as const, issues: validation.issues };
      }
      const vars = themeDocumentToPreviewVars(validation.data, previewMode);
      return { status: 'ok' as const, vars };
    } catch {
      return { status: 'parse' as const };
    }
  }, [editorValue, previewMode, editingThemeId]);

  const beginEdit = (id: string) => {
    if (isDirty) {
      setPendingEditId(id);
      setDiscardOpen(true);
      return;
    }
    setEditingThemeId(id);
    setLibraryFocusId(id);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const confirmDiscardAndSwitch = () => {
    const next = pendingEditId;
    setDiscardOpen(false);
    setPendingEditId(null);
    if (next) {
      setEditingThemeId(next);
      setLibraryFocusId(next);
      setSaveError(null);
      setSaveSuccess(null);
    }
  };

  const closeEditor = () => {
    if (isDirty) {
      setPendingEditId(null);
      setDiscardOpen(true);
      return;
    }
    setEditingThemeId(null);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleDiscardClose = () => {
    setDiscardOpen(false);
    if (pendingEditId) {
      confirmDiscardAndSwitch();
      return;
    }
    setEditingThemeId(null);
    setSaveError(null);
    setSaveSuccess(null);
    setPendingEditId(null);
  };

  const createNewTheme = () => {
    const preset = getPresetById(presetId);
    const rawDoc = createThemeDocumentFromPreset(preset, themeName);
    const ids = new Set(themeDocuments.map((doc) => doc.id));
    const id = uniqueId(rawDoc.id, ids);
    const now = new Date().toISOString();
    const nextDoc: ThemeDocument = {
      ...rawDoc,
      id,
      updatedAt: now,
      createdAt: rawDoc.createdAt ?? now,
    };
    const nextDocs = withActiveFlags([...themeDocuments, nextDoc], id);

    onChange(nextDocs, id);
    setLibraryFocusId(id);
    setLibraryNotice(`Created "${nextDoc.name}".`);
    setEditingThemeId(id);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const saveJson = () => {
    if (!editingThemeId) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(editorValue);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Invalid JSON.');
      setSaveSuccess(null);
      return;
    }

    const validation = validateThemeDocument(parsed);
    if (!validation.ok) {
      setSaveError(`Theme JSON failed validation:\n${formatIssues(validation.issues)}`);
      setSaveSuccess(null);
      return;
    }

    const now = new Date().toISOString();
    const incoming = parsed as ThemeDocument;
    const normalizedDoc: ThemeDocument = {
      ...incoming,
      id: editingThemeId,
      updatedAt: now,
      createdAt: editingTheme?.createdAt ?? incoming.createdAt ?? now,
      isActive: editingThemeId === (activeThemeDocumentId ?? editingThemeId),
    };

    const nextDocs = themeDocuments.map((doc) => (doc.id === editingThemeId ? normalizedDoc : doc));
    const nextActiveId = activeThemeDocumentId ?? editingThemeId;

    onChange(withActiveFlags(nextDocs, nextActiveId), nextActiveId);
    setSaveError(null);
    setSaveSuccess(`Saved "${normalizedDoc.name}".`);
  };

  const activateTheme = (id: string) => {
    const nextDocs = withActiveFlags(themeDocuments, id);
    onChange(nextDocs, id);
    setLibraryNotice(`"${themeDocuments.find((d) => d.id === id)?.name ?? id}" is now active.`);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    const next = themeDocuments.filter((d) => d.id !== id);
    let nextActive = activeThemeDocumentId ?? null;
    if (activeThemeDocumentId === id) {
      nextActive = next[0]?.id ?? null;
    }
    if (editingThemeId === id) {
      setEditingThemeId(null);
      setEditorValue('');
      setSaveError(null);
      setSaveSuccess(null);
    }
    if (libraryFocusId === id) {
      setLibraryFocusId(next[0]?.id ?? null);
    }
    onChange(withActiveFlags(next, nextActive), nextActive);
    setDeleteTargetId(null);
    setLibraryNotice('Theme deleted.');
  };

  const focusedTheme = themeDocuments.find((d) => d.id === libraryFocusId);

  return (
    <div className={classes.page}>
      <Text size="sm" c="dimmed">
        Manage themes in the library, then open one in the editor to change JSON and preview. Saving writes to this
        display&apos;s config.
      </Text>

      {libraryNotice && (
        <Alert color="blue" onClose={() => setLibraryNotice(null)} withCloseButton>
          <Text size="sm">{libraryNotice}</Text>
        </Alert>
      )}

      <div className={classes.mainLayout}>
        {/* —— Library —— */}
        <Paper withBorder p="md" radius="md" className={classes.library}>
          <Stack gap="md" style={{ height: '100%', minHeight: 0 }}>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600}>Theme library</Text>
              <Badge variant="light" size="sm">
                {themeDocuments.length} saved
              </Badge>
            </Group>

            <ScrollArea className={classes.libraryScroll} type="auto" offsetScrollbars>
              <Stack gap="xs">
                {themeDocuments.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No themes yet. Create one below.
                  </Text>
                ) : (
                  themeDocuments.map((doc) => {
                    const isFocus = libraryFocusId === doc.id;
                    const isLive = activeThemeDocumentId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className={`${classes.themeRow} ${isFocus ? classes.themeRowSelected : ''} ${isLive ? classes.themeRowActive : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setLibraryFocusId(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setLibraryFocusId(doc.id);
                          }
                        }}
                      >
                        <div className={classes.themeRowHeader}>
                          <Text size="sm" fw={600} lineClamp={2}>
                            {doc.name}
                          </Text>
                          {isLive && (
                            <Badge size="xs" color="teal" variant="filled">
                              Active
                            </Badge>
                          )}
                        </div>
                        <Text className={classes.themeRowMeta} truncate>
                          {doc.id}
                        </Text>
                        <div className={classes.themeRowActions}>
                          <Tooltip label="Edit JSON & preview">
                            <ActionIcon
                              variant="light"
                              color="indigo"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                beginEdit(doc.id);
                              }}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Set as active theme">
                            <ActionIcon
                              variant="light"
                              color="teal"
                              size="sm"
                              disabled={isLive}
                              onClick={(e) => {
                                e.stopPropagation();
                                activateTheme(doc.id);
                              }}
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete theme">
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTargetId(doc.id);
                              }}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })
                )}
              </Stack>
            </ScrollArea>

            <Stack gap="sm" style={{ borderTop: '1px solid var(--mantine-color-default-border)', paddingTop: '0.75rem' }}>
              <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                New theme
              </Text>
              <TextInput
                label="Name"
                size="xs"
                value={themeName}
                onChange={(event) => setThemeName(event.currentTarget.value)}
                placeholder="My theme"
              />
              <Select
                label="From preset"
                size="xs"
                data={THEME_PRESET_OPTIONS}
                value={presetId}
                onChange={(value) => value && setPresetId(value)}
                allowDeselect={false}
              />
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={createNewTheme}
                disabled={!themeName.trim()}
              >
                Create theme
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* —— Edit workspace —— */}
        <Paper withBorder p="md" radius="md" className={classes.workspace}>
          {!editingThemeId ? (
            <div className={classes.workspaceEmpty}>
              <Stack gap="sm" align="center" maw={360}>
                <Text fw={600} ta="center">
                  Edit workspace
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  Choose a theme in the library and click the pencil to edit its JSON and see a live preview. Active
                  theme is used when you save config; use the checkmark in the library to switch which one is active.
                </Text>
                {focusedTheme && (
                  <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => beginEdit(focusedTheme.id)}>
                    Edit &quot;{focusedTheme.name}&quot;
                  </Button>
                )}
              </Stack>
            </div>
          ) : (
            <Stack gap="md" className={classes.workspaceBody}>
              <Group justify="space-between" align="flex-start" wrap="wrap" className={classes.workspaceHeader}>
                <div>
                  <Text fw={600}>Editing</Text>
                  <Text size="sm" c="dimmed">
                    {editingTheme?.name ?? editingThemeId}
                    {isDirty ? (
                      <Badge ml="xs" size="xs" color="orange" variant="light">
                        Unsaved
                      </Badge>
                    ) : null}
                  </Text>
                </div>
                <Group gap="xs">
                  <Button variant="default" size="sm" leftSection={<IconX size={16} />} onClick={closeEditor}>
                    Close
                  </Button>
                  <Button size="sm" onClick={saveJson}>
                    Save JSON
                  </Button>
                </Group>
              </Group>

              <div className={classes.editorPreviewRow}>
                <div className={classes.editorColumn}>
                  <Stack gap="sm">
                    <Textarea
                      label="Theme JSON"
                      minRows={18}
                      maxRows={36}
                      autosize
                      classNames={{ input: classes.textarea }}
                      value={editorValue}
                      onChange={(event) => setEditorValue(event.currentTarget.value)}
                      spellCheck={false}
                    />

                    {saveError && (
                      <Alert color="red" icon={<IconAlertCircle size={16} />}>
                        <Text size="sm" component="pre" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                          {saveError}
                        </Text>
                      </Alert>
                    )}
                    {saveSuccess && (
                      <Alert color="green">
                        <Text size="sm">{saveSuccess}</Text>
                      </Alert>
                    )}

                    <Text size="xs" c="dimmed">
                      Validation matches <Code>schemas/theme-document.schema.json</Code>.
                    </Text>
                  </Stack>
                </div>

                <div className={classes.previewColumn}>
                  <Stack gap="sm">
                    <Group justify="space-between" align="center" wrap="wrap">
                      <Text size="sm" fw={600}>
                        Live preview
                      </Text>
                      <SegmentedControl
                        size="xs"
                        value={previewMode}
                        onChange={(v) => setPreviewMode(v as ColorMode)}
                        data={[
                          { label: 'Dark', value: 'dark' },
                          { label: 'Light', value: 'light' },
                        ]}
                      />
                    </Group>

                    <div className={classes.previewShell}>
                      {previewResult.status === 'ok' ? (
                        <div
                          className={classes.previewCanvas}
                          style={previewResult.vars as CSSProperties}
                        >
                          <div className={classes.previewToolbar}>Widget toolbar</div>
                          <div className={classes.previewWidget}>
                            <p className={classes.previewWidgetTitle}>Sample widget</p>
                            <p className={classes.previewWidgetMuted}>Secondary text uses muted tokens.</p>
                            <span className={classes.previewButton}>Accent button</span>
                          </div>
                        </div>
                      ) : (
                        <div className={classes.previewPlaceholder}>
                          {previewResult.status === 'empty' && 'Edit JSON to see a preview.'}
                          {previewResult.status === 'parse' && 'Fix JSON syntax to preview this theme.'}
                          {previewResult.status === 'invalid' && (
                            <Stack gap="xs" align="center">
                              <Text size="sm" fw={500}>
                                Preview needs a valid theme document
                              </Text>
                              <Text size="xs" c="dimmed" ta="center" maw={280}>
                                {formatIssues(previewResult.issues)}
                              </Text>
                            </Stack>
                          )}
                        </div>
                      )}
                    </div>
                  </Stack>
                </div>
              </div>
            </Stack>
          )}
        </Paper>
      </div>

      <Modal
        opened={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        title="Delete theme?"
        centered
        size="sm"
      >
        <Text size="sm">
          This removes the theme from this display&apos;s library. This cannot be undone.
        </Text>
        <Group justify="flex-end" mt="md" gap="sm">
          <Button variant="default" onClick={() => setDeleteTargetId(null)}>
            Cancel
          </Button>
          <Button color="red" onClick={confirmDelete}>
            Delete
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={discardOpen}
        onClose={() => {
          setDiscardOpen(false);
          setPendingEditId(null);
        }}
        title="Discard unsaved changes?"
        centered
        size="sm"
      >
        <Text size="sm">
          {pendingEditId
            ? 'Save or discard your edits before opening another theme.'
            : 'You have unsaved edits. Close the editor and discard them?'}
        </Text>
        <Group justify="flex-end" mt="md" gap="sm">
          <Button
            variant="default"
            onClick={() => {
              setDiscardOpen(false);
              setPendingEditId(null);
            }}
          >
            Cancel
          </Button>
          <Button color="orange" onClick={handleDiscardClose}>
            Discard
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
