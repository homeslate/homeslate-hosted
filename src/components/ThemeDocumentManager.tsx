import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  ColorInput,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconColorPicker,
  IconEdit,
  IconLink,
  IconPalette,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import type { ColorMode } from '../types/theme';
import type { ThemeDocument } from '../types/theme';
import type { DashboardLayout } from '../types/widget';
import { BackgroundSlideshow, DocumentCanvas } from '@homeslate/display/canvas';
import { displayRecordToDocument } from '../displayDocumentBridge';
import {
  validateThemeDocument,
  type ThemeValidationIssue,
} from '../themes/themeDocumentValidation';
import { getPresetById, THEME_PRESET_OPTIONS, resolveTheme, themeToVars } from '../themes';
import {
  TAILWIND_COLOR_PALETTES,
  TAILWIND_COMPACT_COLOR_SWATCHES,
  TAILWIND_PALETTE_NAMES,
  TAILWIND_PALETTE_STEPS,
} from '../themes/tailwindPalette';
import {
  buildReferenceOptions,
  getEditableTokenEntries,
  getWidgetTokenSections,
  setTokenValue,
  tokenCssVarName,
  type EditableTokenEntry,
  type EditableTokenType,
  type ReferenceOption,
} from '../themes/themeEditorModel';

function createThemeDocumentFromPreset(presetId: string, name: string): ThemeDocument {
  const base = getPresetById(presetId);
  return {
    ...base,
    id: `custom_${Date.now()}`,
    name,
    isActive: false,
  };
}

function themeDocumentToPreviewVars(doc: ThemeDocument, mode: ColorMode) {
  const resolved = resolveTheme(doc, mode);
  return themeToVars(resolved);
}
import classes from './ThemeDocumentManager.module.css';

const Dashboard = DocumentCanvas;

interface ThemeDocumentManagerProps {
  documents: ThemeDocument[] | undefined;
  activeThemeDocumentId: string | null | undefined;
  previewLayouts?: DashboardLayout[];
  initialPreviewLayoutId?: string | null;
  onChange: (documents: ThemeDocument[], activeThemeDocumentId: string | null) => void;
}

const ALIAS_VALUE_RE = /^\{[\w.]+\}$/;

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

function getInitialThemeId(documents: ThemeDocument[], activeThemeDocumentId: string | null | undefined): string | null {
  if (activeThemeDocumentId && documents.some((doc) => doc.id === activeThemeDocumentId)) {
    return activeThemeDocumentId;
  }
  return documents[0]?.id ?? null;
}

interface TokenControlProps {
  entry: EditableTokenEntry;
  references: ReferenceOption[];
  onChange: (entry: EditableTokenEntry, value: string) => void;
}

function tokenTypeLabel(type: EditableTokenType): string {
  if (type === 'fontFamily') return 'Font family';
  if (type === 'dimension') return 'Dimension';
  return 'Color';
}

function defaultDirectValue(type: EditableTokenType): string {
  if (type === 'fontFamily') return "'Outfit', sans-serif";
  if (type === 'dimension') return '12px';
  return '#6366f1';
}

function tailwindTokenPath(name: string, step: string): string {
  return `foundation.color.${name}.${step}`;
}

function canPreviewColorValue(value: string): boolean {
  return !ALIAS_VALUE_RE.test(value) && !value.includes('gradient');
}

function TokenControl({ entry, references, onChange }: TokenControlProps) {
  const isReference = ALIAS_VALUE_RE.test(entry.value);
  const referenceValue = references.some((option) => option.value === entry.value) ? entry.value : null;
  const referenceFallback = references[0]?.value;
  const typeLabel = tokenTypeLabel(entry.type);
  const cssVarName = tokenCssVarName(entry.referencePath);
  const [paletteBrowserOpen, setPaletteBrowserOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [referenceBrowserOpen, setReferenceBrowserOpen] = useState(false);
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const customColorValue = isReference ? defaultDirectValue("color") : entry.value;
  const filteredPaletteNames = useMemo(() => {
    const query = paletteQuery.trim().toLowerCase();
    if (!query) return TAILWIND_PALETTE_NAMES;

    return TAILWIND_PALETTE_NAMES.filter((name) =>
      TAILWIND_PALETTE_STEPS.some((step) => {
        const value = TAILWIND_COLOR_PALETTES[name][step];
        const tokenPath = tailwindTokenPath(name, step);
        return `${name} ${step} ${tokenPath} ${value}`.toLowerCase().includes(query);
      }),
    );
  }, [paletteQuery]);

  return (
    <Paper withBorder radius="md" p="sm" className={classes.colorTokenCard}>
      <Stack gap="xs">
        <div>
          <Group justify="space-between" gap="xs" align="flex-start" wrap="nowrap">
            <Text size="sm" fw={600} className={classes.tokenLabel}>
              {entry.label}
            </Text>
            {entry.referencePath.startsWith('components.widget.') && (
              <Badge size="xs" variant="light" color="indigo">
                Widget-related
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            {entry.referencePath}
          </Text>
          <Text size="xs" c="dimmed" className={classes.tokenCssVar}>
            CSS var <Code>{cssVarName}</Code>
          </Text>
        </div>

        {entry.type === 'color' ? (
          <>
            <Group gap="xs" align="flex-end" wrap="nowrap" className={classes.colorValueRow}>
              <TextInput
                label="Color value"
                size="xs"
                value={entry.value}
                onChange={(event) => onChange(entry, event.currentTarget.value)}
                placeholder="#6366f1, oklch(...), or {foundation.color.red.500}"
                className={classes.colorValueInput}
                leftSection={
                  canPreviewColorValue(entry.value) ? (
                    <span className={classes.colorPreviewChip} style={{ background: entry.value }} />
                  ) : undefined
                }
                leftSectionWidth={canPreviewColorValue(entry.value) ? 34 : undefined}
              />
              <Group gap={4} wrap="nowrap" className={classes.colorSourceActions}>
                <Tooltip label="Browse palettes">
                  <ActionIcon
                    variant="subtle"
                    aria-label="Browse palettes"
                    onClick={() => setPaletteBrowserOpen(true)}
                  >
                    <IconPalette size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Reference another token">
                  <ActionIcon
                    variant="subtle"
                    aria-label="Reference another token"
                    onClick={() => setReferenceBrowserOpen(true)}
                    disabled={references.length === 0}
                  >
                    <IconLink size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Pick custom color">
                  <ActionIcon
                    variant="subtle"
                    aria-label="Pick custom color"
                    onClick={() => setCustomColorOpen(true)}
                  >
                    <IconColorPicker size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <Modal
              opened={customColorOpen}
              onClose={() => setCustomColorOpen(false)}
              title="Pick custom color"
              size="sm"
            >
              <ColorInput
                label="Color value"
                size="sm"
                value={customColorValue}
                onChange={(value) => onChange(entry, value)}
                placeholder="#6366f1"
                swatches={TAILWIND_COMPACT_COLOR_SWATCHES}
              />
            </Modal>
            <Modal
              opened={referenceBrowserOpen}
              onClose={() => setReferenceBrowserOpen(false)}
              title="Reference another token"
              size="lg"
            >
              <Select
                label="Search token references"
                size="sm"
                data={references}
                value={referenceValue}
                onChange={(value) => {
                  if (!value) return;
                  onChange(entry, value);
                  setReferenceBrowserOpen(false);
                }}
                placeholder="Search token references"
                searchable
                clearable={false}
                maxDropdownHeight={360}
              />
            </Modal>
            <Modal
              opened={paletteBrowserOpen}
              onClose={() => setPaletteBrowserOpen(false)}
              title="Browse palettes"
              size="xl"
              scrollAreaComponent={ScrollArea.Autosize}
            >
              <Stack gap="sm">
                <TextInput
                  label="Search palettes, shades, paths, or OKLCH"
                  size="sm"
                  value={paletteQuery}
                  onChange={(event) => setPaletteQuery(event.currentTarget.value)}
                  placeholder="red 500, foundation.color.sky.950, oklch..."
                />
                <Text size="xs" c="dimmed">
                  Pick a direct OKLCH value. Use the reference button if you want to keep the token path instead.
                </Text>
                <div className={classes.paletteBrowserGrid}>
                  {filteredPaletteNames.map((name) => (
                    <div key={name} className={classes.paletteFamilyRow}>
                      <div className={classes.paletteFamilyLabel}>
                        <Text size="sm" fw={700}>
                          {name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {`foundation.color.${name}`}
                        </Text>
                      </div>
                      <div className={classes.paletteShadeGrid}>
                        {TAILWIND_PALETTE_STEPS.map((step) => {
                          const value = TAILWIND_COLOR_PALETTES[name][step];
                          const tokenPath = tailwindTokenPath(name, step);
                          return (
                            <button
                              key={step}
                              type="button"
                              className={classes.paletteShadeButton}
                              onClick={() => {
                                onChange(entry, value);
                                setPaletteBrowserOpen(false);
                              }}
                              title={`${tokenPath} (${value})`}
                            >
                              <span className={classes.paletteShadeChip} style={{ background: value }} />
                              <span className={classes.paletteShadeLabel}>{step}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {filteredPaletteNames.length === 0 && (
                  <Text size="sm" c="dimmed">
                    No palette colors match that search.
                  </Text>
                )}
              </Stack>
            </Modal>
          </>
        ) : (
          <>
            <SegmentedControl
              size="xs"
              value={isReference ? 'reference' : 'direct'}
              onChange={(value) => {
                if (value === 'direct' && isReference) {
                  onChange(entry, defaultDirectValue(entry.type));
                  return;
                }
                if (value === 'reference' && !isReference && referenceFallback) {
                  onChange(entry, referenceFallback);
                }
              }}
              data={[
                { label: 'Direct', value: 'direct' },
                { label: 'Reference', value: 'reference' },
              ]}
              fullWidth
            />
            {!isReference ? (
              <TextInput
                label={typeLabel}
                size="xs"
                value={entry.value}
                onChange={(event) => onChange(entry, event.currentTarget.value)}
                placeholder={entry.type === 'fontFamily' ? "'Outfit', sans-serif" : '12px'}
              />
            ) : (
              <Select
                label={`Reference ${typeLabel.toLowerCase()}`}
                size="xs"
                data={references}
                value={referenceValue}
                onChange={(value) => value && onChange(entry, value)}
                placeholder="Reference another token"
                searchable
                clearable={false}
              />
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function ThemeDocumentManager({
  documents,
  activeThemeDocumentId,
  previewLayouts = [],
  initialPreviewLayoutId,
  onChange,
}: ThemeDocumentManagerProps) {
  const themeDocuments = useMemo(() => documents ?? [], [documents]);
  const initialThemeId = useMemo(
    () => getInitialThemeId(themeDocuments, activeThemeDocumentId),
    [activeThemeDocumentId, themeDocuments]
  );

  /** Row highlight in the library (which theme actions apply to). */
  const [libraryFocusId, setLibraryFocusId] = useState<string | null>(initialThemeId);
  /** When set, the JSON + preview workspace is open for this theme id. */
  const [editingThemeId, setEditingThemeId] = useState<string | null>(initialThemeId);

  const [editorValue, setEditorValue] = useState('');
  const [themeName, setThemeName] = useState('Custom Theme');
  const [presetId, setPresetId] = useState<string>(THEME_PRESET_OPTIONS[0]?.value ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<ColorMode>('dark');
  const [editorTab, setEditorTab] = useState<string | null>('quick');
  const [widgetTokenQuery, setWidgetTokenQuery] = useState('');
  const [previewLayoutId, setPreviewLayoutId] = useState<string | null>(
    initialPreviewLayoutId ?? previewLayouts[0]?.id ?? null
  );

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
    if (!libraryFocusId && initialThemeId) {
      setLibraryFocusId(initialThemeId);
      if (!editingThemeId) setEditingThemeId(initialThemeId);
      return;
    }
    if (libraryFocusId && !themeDocuments.some((doc) => doc.id === libraryFocusId)) {
      setLibraryFocusId(initialThemeId);
      if (!editingThemeId) setEditingThemeId(initialThemeId);
    }
  }, [editingThemeId, initialThemeId, libraryFocusId, themeDocuments]);

  useEffect(() => {
    if (previewLayoutId && previewLayouts.some((layout) => layout.id === previewLayoutId)) {
      return;
    }
    setPreviewLayoutId(initialPreviewLayoutId ?? previewLayouts[0]?.id ?? null);
  }, [initialPreviewLayoutId, previewLayoutId, previewLayouts]);

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
      return { status: 'ok' as const, doc: validation.data, vars };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { status: 'parse' as const };
      }
      return {
        status: 'invalid' as const,
        issues: [{ path: '$', message: error instanceof Error ? error.message : 'Unable to resolve theme.' }],
      };
    }
  }, [editorValue, previewMode, editingThemeId]);

  const editableTokenEntries = useMemo(
    () => (previewResult.status === 'ok' ? getEditableTokenEntries(previewResult.doc, previewMode) : []),
    [previewMode, previewResult]
  );

  const widgetTokenSections = useMemo(
    () => getWidgetTokenSections(editableTokenEntries, widgetTokenQuery),
    [editableTokenEntries, widgetTokenQuery]
  );

  const groupedTokenEntries = useMemo(() => {
    const groups = new Map<EditableTokenType, EditableTokenEntry[]>();
    for (const entry of editableTokenEntries) {
      const groupName = entry.type;
      groups.set(groupName, [...(groups.get(groupName) ?? []), entry]);
    }
    return Array.from(groups.entries());
  }, [editableTokenEntries]);

  const referenceOptionsByType = useMemo(
    () => ({
      color: previewResult.status === 'ok' ? buildReferenceOptions(previewResult.doc, previewMode, 'color') : [],
      fontFamily: previewResult.status === 'ok' ? buildReferenceOptions(previewResult.doc, previewMode, 'fontFamily') : [],
      dimension: previewResult.status === 'ok' ? buildReferenceOptions(previewResult.doc, previewMode, 'dimension') : [],
    }),
    [previewMode, previewResult]
  );

  const activePreviewLayout = previewLayouts.find((layout) => layout.id === previewLayoutId) ?? previewLayouts[0] ?? null;
  const previewDocument = useMemo(
    () =>
      displayRecordToDocument({
        layouts: previewLayouts,
        activeLayoutId: previewLayouts[0]?.id ?? null,
        rotationEnabled: false,
        rotationIntervalMs: 30000,
      }),
    [previewLayouts],
  );
  const activePreviewView =
    previewDocument.views.find((v) => v.id === activePreviewLayout?.id) ??
    previewDocument.views[0] ??
    null;

  const updateToken = (entry: EditableTokenEntry, value: string) => {
    if (previewResult.status !== 'ok') return;
    const nextDoc = setTokenValue(previewResult.doc, entry.tokenPath, value, entry.type);
    setEditorValue(JSON.stringify(nextDoc, null, 2));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const referencesFor = (entry: EditableTokenEntry) =>
    referenceOptionsByType[entry.type].filter((option) => option.value !== `{${entry.referencePath}}`);

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
    const rawDoc = createThemeDocumentFromPreset(presetId, themeName);
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
    setEditorValue(JSON.stringify(normalizedDoc, null, 2));
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
                        onClick={() => beginEdit(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            beginEdit(doc.id);
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
                  <Text size="sm" c="dimmed" component="div">
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
                    <Tabs value={editorTab} onChange={setEditorTab} keepMounted={false}>
                      <Tabs.List className={classes.editorTabsList}>
                        <Tabs.Tab value="quick">Widget tokens</Tabs.Tab>
                        <Tabs.Tab value="all">All tokens</Tabs.Tab>
                        <Tabs.Tab value="json">Theme JSON</Tabs.Tab>
                      </Tabs.List>

                      <Tabs.Panel value="quick" pt="sm">
                        {previewResult.status === 'ok' ? (
                          <Stack gap="sm">
                            <div className={classes.widgetTokenIntro}>
                              <TextInput
                                size="xs"
                                label="Filter widget tokens"
                                placeholder="Search token, CSS variable, or value"
                                value={widgetTokenQuery}
                                onChange={(event) => setWidgetTokenQuery(event.currentTarget.value)}
                                className={classes.widgetTokenSearch}
                              />
                            </div>

                            {widgetTokenSections.length === 0 ? (
                              <Paper withBorder p="md" radius="md">
                                <Text size="sm" c="dimmed">
                                  No widget-related tokens match this filter.
                                </Text>
                              </Paper>
                            ) : (
                              <Stack gap="md">
                                {widgetTokenSections.map((section) => (
                                  <section key={section.id} className={classes.tokenSection}>
                                    <Group justify="space-between" gap="xs" align="flex-start" wrap="nowrap">
                                      <div>
                                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                                          {section.title}
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                          {section.description}
                                        </Text>
                                      </div>
                                      <Badge size="xs" variant="outline">
                                        {section.entries.length} tokens
                                      </Badge>
                                    </Group>
                                    <div className={classes.colorTokenGrid}>
                                      {section.entries.map((entry) => (
                                        <TokenControl
                                          key={entry.referencePath}
                                          entry={entry}
                                          references={referencesFor(entry)}
                                          onChange={updateToken}
                                        />
                                      ))}
                                    </div>
                                  </section>
                                ))}
                              </Stack>
                            )}
                          </Stack>
                        ) : (
                          <Alert color="yellow">Fix the theme JSON before editing tokens in the GUI.</Alert>
                        )}
                      </Tabs.Panel>

                      <Tabs.Panel value="all" pt="sm">
                        {previewResult.status === 'ok' ? (
                          <Stack gap="md">
                            {groupedTokenEntries.map(([groupName, entries]) => (
                              <Stack gap="sm" key={groupName}>
                                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                                  {tokenTypeLabel(groupName)}
                                </Text>
                                <div className={classes.colorTokenGrid}>
                                  {entries.map((entry) => (
                                    <TokenControl
                                      key={entry.referencePath}
                                      entry={entry}
                                      references={referencesFor(entry)}
                                      onChange={updateToken}
                                    />
                                  ))}
                                </div>
                              </Stack>
                            ))}
                          </Stack>
                        ) : (
                          <Alert color="yellow">Fix the theme JSON before editing tokens in the GUI.</Alert>
                        )}
                      </Tabs.Panel>

                      <Tabs.Panel value="json" pt="sm">
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
                      </Tabs.Panel>
                    </Tabs>

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
                      Validation matches <Code>packages/schema/schemas/theme-document.schema.json</Code>.
                    </Text>
                  </Stack>
                </div>

                <div className={classes.previewColumn}>
                  <Stack gap="sm">
                    <Group justify="space-between" align="center" wrap="wrap">
                      <Text size="sm" fw={600}>
                        View preview
                      </Text>
                      <Group gap="xs">
                        {previewLayouts.length > 0 && (
                          <Select
                            size="xs"
                            data={previewLayouts.map((layout) => ({ value: layout.id, label: layout.name }))}
                            value={activePreviewLayout?.id ?? null}
                            onChange={setPreviewLayoutId}
                            allowDeselect={false}
                            className={classes.previewViewSelect}
                          />
                        )}
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
                    </Group>

                    <div className={classes.previewShell}>
                      {previewResult.status === 'ok' ? (
                        <div
                          className={classes.previewCanvas}
                          style={previewResult.vars as CSSProperties}
                        >
                          {activePreviewView ? (
                            <div className={classes.actualPreviewViewport}>
                              <BackgroundSlideshow view={activePreviewView} />
                              <Dashboard
                                view={activePreviewView}
                                isEditing={false}
                              />
                            </div>
                          ) : (
                            <>
                              <div className={classes.previewToolbar}>Widget toolbar</div>
                              <div className={classes.previewWidget}>
                                <p className={classes.previewWidgetTitle}>Sample widget</p>
                                <p className={classes.previewWidgetMuted}>Secondary text uses muted tokens.</p>
                                <span className={classes.previewButton}>Accent button</span>
                              </div>
                            </>
                          )}
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
