import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Group,
  Text,
  Title,
  Button,
  ActionIcon,
  Tooltip,
  Stack,
  Paper,
  UnstyledButton,
  Avatar,
  Menu,
  Switch,
  Select,
  Badge,
  TextInput,
  PinInput,
  Modal,
} from '@mantine/core';
import * as TablerIcons from '@tabler/icons-react';
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconDeviceTv,
  IconLogout,
  IconEdit,
  IconCheck,
  IconX,
  IconShare,
  IconLock,
  IconLockOpen,
  IconGripVertical,
  IconEye,
  IconEyeOff,
  IconUserPlus,
  IconSun,
  IconMoon,
  IconMoodSmile,
  IconLayoutGrid,
  IconSettings,
  IconPalette,
} from '@tabler/icons-react';
import { IconPickerModal } from '../components/IconPickerModal';
import { AlarmListEditor } from '../alarms/AlarmListEditor';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { v4 as uuidv4 } from 'uuid';
import { ShareDisplayModal } from '../components/ShareDisplayModal';
import { InviteModal } from '../components/InviteModal';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import { ThemeDocumentManager } from '../components/ThemeDocumentManager';
import { HOLIDAY_PREVIEW_OPTIONS } from '../holidays/registry';
import type { HolidayId } from '../holidays/registry';
import { getWidgetByType } from '../widgets/registry';
import type { ColorMode } from '../types/theme';
import type { DashboardLayout, WidgetDefinition } from '../types/widget';
import { apiClient, ApiError } from '../services/apiClient';
import type { ConfigUpsertRequest, DisplayPasscodeRequest, DisplayRenameRequest } from '../types/api';
import classes from './DisplayDetailPage.module.css';

const INTERVAL_OPTIONS = [
  { value: '15000',   label: '15 seconds' },
  { value: '30000',   label: '30 seconds' },
  { value: '60000',   label: '1 minute'   },
  { value: '300000',  label: '5 minutes'  },
  { value: '600000',  label: '10 minutes' },
  { value: '1800000', label: '30 minutes' },
];

const PRESET_VIEW_NAMES = ['Morning', 'Evening', 'Weekend'] as const;
type ManagementPage = 'views' | 'settings' | 'theme';

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createPresetWidget(
  type: string,
  x: number,
  y: number,
  overrides: Partial<Pick<WidgetDefinition['layout'], 'w' | 'h'>> = {}
): WidgetDefinition | null {
  const entry = getWidgetByType(type);
  if (!entry) return null;

  return {
    id: uuidv4(),
    type: entry.type,
    title: entry.name,
    config: cloneConfig(entry.defaultConfig),
    layout: {
      x,
      y,
      w: overrides.w ?? entry.defaultLayout.w,
      h: overrides.h ?? entry.defaultLayout.h,
      minW: entry.defaultLayout.minW,
      minH: entry.defaultLayout.minH,
      maxW: entry.defaultLayout.maxW,
      maxH: entry.defaultLayout.maxH,
    },
  };
}

function createPresetLayout(name: (typeof PRESET_VIEW_NAMES)[number]): DashboardLayout {
  const iconByName: Record<(typeof PRESET_VIEW_NAMES)[number], string> = {
    Morning: 'IconSun',
    Evening: 'IconMoon',
    Weekend: 'IconCalendarWeek',
  };

  const widgetSpecs: Record<(typeof PRESET_VIEW_NAMES)[number], Array<{ type: string; x: number; y: number; w?: number; h?: number }>> = {
    Morning: [
      { type: 'clock', x: 0, y: 0 },
      { type: 'weather', x: 3, y: 0 },
      { type: 'google-calendar-day', x: 6, y: 0, w: 3, h: 4 },
      { type: 'todo', x: 9, y: 0, w: 3, h: 4 },
      { type: 'news', x: 0, y: 3, w: 6, h: 4 },
    ],
    Evening: [
      { type: 'clock', x: 0, y: 0 },
      { type: 'todo', x: 3, y: 0, w: 3, h: 4 },
      { type: 'google-calendar-day', x: 6, y: 0, w: 3, h: 4 },
      { type: 'photo', x: 9, y: 0, w: 3, h: 3 },
      { type: 'weather', x: 0, y: 2, w: 3, h: 3 },
    ],
    Weekend: [
      { type: 'clock', x: 0, y: 0 },
      { type: 'google-calendar-month', x: 3, y: 0, w: 5, h: 5 },
      { type: 'todo', x: 8, y: 0, w: 4, h: 4 },
      { type: 'weather', x: 0, y: 2, w: 3, h: 3 },
      { type: 'news', x: 8, y: 4, w: 4, h: 3 },
    ],
  };

  const widgets = widgetSpecs[name]
    .map((spec) => createPresetWidget(spec.type, spec.x, spec.y, { w: spec.w, h: spec.h }))
    .filter((widget): widget is WidgetDefinition => widget !== null);

  return {
    id: uuidv4(),
    name,
    icon: iconByName[name],
    widgets,
    columns: 12,
    rowHeight: 80,
  };
}

// ─── Sortable view card ────────────────────────────────────────────────────────

interface ViewCardProps {
  layout: DashboardLayout;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onToggleHidden: () => void;
  onSetIcon: (icon: string | undefined) => void;
}

function SortableViewCard({ layout, onSelect, onDelete, onRename, onToggleHidden, onSetIcon }: ViewCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: layout.id,
  });
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(layout.name);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const CurrentIcon = layout.icon
    ? (TablerIcons as Record<string, unknown>)[layout.icon] as React.ComponentType<{ size?: number; stroke?: number }> | null
    : null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const commitRename = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== layout.name) {
      onRename(trimmed);
    } else {
      setNameValue(layout.name);
    }
    setEditing(false);
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameValue(layout.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      className={`${classes.viewCard} ${layout.hidden ? classes.viewCardHidden : ''}`}
      p="sm"
      radius="md"
    >
      <Group justify="space-between" gap="xs" wrap="nowrap">
        {/* Drag handle */}
        <ActionIcon
          variant="subtle"
          size="sm"
          className={classes.dragHandle}
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', flexShrink: 0 }}
          tabIndex={-1}
        >
          <IconGripVertical size={14} />
        </ActionIcon>

        {/* Name / edit */}
        {editing ? (
          <Group gap={4} style={{ flex: 1 }}>
            <TextInput
              ref={inputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setNameValue(layout.name); setEditing(false); }
              }}
              size="xs"
              style={{ flex: 1 }}
            />
            <ActionIcon variant="subtle" color="green" size="sm" onClick={commitRename}>
              <IconCheck size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => { setNameValue(layout.name); setEditing(false); }}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        ) : (
          <UnstyledButton
            className={classes.viewCardBtn}
            onClick={onSelect}
          >
            <Stack gap={2}>
              <Group gap={4} wrap="nowrap">
                <Text fw={500} size="sm" style={{ opacity: layout.hidden ? 0.45 : 1 }}>
                  {layout.name}
                </Text>
                {layout.hidden && (
                  <Badge variant="outline" size="xs" color="gray">hidden</Badge>
                )}
              </Group>
              <Badge variant="light" size="xs" color="dark" w="fit-content">
                {layout.widgets.length} {layout.widgets.length === 1 ? 'widget' : 'widgets'}
              </Badge>
            </Stack>
          </UnstyledButton>
        )}

        {/* Actions */}
        {!editing && (
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Tooltip label={layout.icon ? 'Change view icon' : 'Set view icon'}>
              <ActionIcon
                variant={layout.icon ? 'light' : 'subtle'}
                color={layout.icon ? 'blue' : 'gray'}
                size="sm"
                onClick={(e) => { e.stopPropagation(); setIconPickerOpen(true); }}
              >
                {CurrentIcon ? <CurrentIcon size={14} stroke={1.5} /> : <IconMoodSmile size={14} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Rename view">
              <ActionIcon variant="subtle" size="sm" onClick={startEditing}>
                <IconEdit size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={layout.hidden ? 'Show view' : 'Hide view'}>
              <ActionIcon
                variant="subtle"
                size="sm"
                color={layout.hidden ? 'gray' : 'blue'}
                onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
              >
                {layout.hidden ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete view">
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>
      <IconPickerModal
        opened={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        currentIcon={layout.icon}
        onSelect={onSetIcon}
      />
    </Paper>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function DisplayDetailPage() {
  const { user, accessToken, signOut } = useAuth();
  const navigate = useNavigate();
  const {
    displays,
    selectedDisplayId,
    renameDisplay,
    createLayout,
    upsertDisplay,
    deleteLayout,
    renameLayout,
    reorderLayouts,
    toggleLayoutHidden,
    setLayoutIcon,
    setRotationEnabled,
    setRotationIntervalMs,
    setColorMode,
    setPasscodeEnabled,
    setStickyNotesEnabled,
    setVoiceEnabled,
    setHolidayEffectsEnabled,
    setHolidayPreviewId,
    setAlarms,
    openPreview,
  } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const colorMode: ColorMode = display?.colorMode ?? 'dark';
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(display?.name ?? '');
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  // Dialog modals replacing native alert / confirm / prompt
  const [alertOpen, setAlertOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newViewOpen, setNewViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('New View');
  const [activePage, setActivePage] = useState<ManagementPage>('views');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const alarmsSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!display) return null;

  const saveConfig = (overrides: Partial<typeof display> = {}) => {
    if (!accessToken) return;
    const {
      layouts,
      activeLayoutId,
      rotationEnabled,
      rotationIntervalMs,
      themes,
      activeThemeId,
      colorMode: savedColorMode,
      stickyNotesEnabled,
      voiceEnabled,
      holidayEffectsEnabled,
      holidayPreviewId,
      alarms,
    } = {
      ...display,
      ...overrides,
    };
    const payload: ConfigUpsertRequest = {
      layouts,
      activeLayoutId,
      rotationEnabled,
      rotationIntervalMs,
      themes,
      activeThemeId,
      colorMode: savedColorMode,
      stickyNotesEnabled,
      voiceEnabled,
      holidayEffectsEnabled,
      holidayPreviewId,
      alarms,
    };
    void apiClient
      .put<unknown, ConfigUpsertRequest>('/api/config', {
        token: accessToken,
        query: { displayId: display.id },
        body: payload,
      })
      .catch(console.error);
  };

  const handleRename = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === display.name) {
      setEditingName(false);
      return;
    }
    renameDisplay(display.id, trimmed);
    setEditingName(false);
    if (accessToken) {
      void apiClient
        .patch<unknown, DisplayRenameRequest>('/api/displays', {
          token: accessToken,
          query: { id: display.id },
          body: { name: trimmed },
        })
        .catch(console.error);
    }
  };

  const handleSavePin = async (pin: string | null) => {
    if (!accessToken) return;
    if (pin !== null && !/^\d{4}$/.test(pin)) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }
    setPinSaving(true);
    setPinError(null);
    try {
      await apiClient.patch<unknown, DisplayPasscodeRequest>('/api/displays', {
        token: accessToken,
        query: { id: display.id },
        body: { passcode: pin },
      });
      setPasscodeEnabled(display.id, pin !== null);
      setPinInput('');
    } catch (err) {
      setPinError(err instanceof ApiError ? err.message : 'Network error');
    } finally {
      setPinSaving(false);
    }
  };

  const handleNewView = () => {
    setNewViewName('New View');
    setNewViewOpen(true);
  };

  const handleAddPresetViews = () => {
    const existing = new Set(display.layouts.map((layout) => layout.name.trim().toLowerCase()));
    const missing = PRESET_VIEW_NAMES.filter((name) => !existing.has(name.toLowerCase()));
    if (missing.length === 0) return;

    const presetLayouts = missing.map((name) => createPresetLayout(name));
    const updatedLayouts = [...display.layouts, ...presetLayouts];

    upsertDisplay({
      ...display,
      layouts: updatedLayouts,
      activeLayoutId: display.activeLayoutId ?? updatedLayouts[0]?.id ?? null,
    });
    saveConfig({ layouts: updatedLayouts });
  };

  const handleDeleteView = (id: string) => {
    if (display.layouts.length <= 1) {
      setAlertOpen(true);
      return;
    }
    setConfirmDeleteId(id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = display.layouts.map((l) => l.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    reorderLayouts(newOrder);
    saveConfig({ layouts: arrayMove(display.layouts, oldIndex, newIndex) });
  };

  const handleRenameView = (id: string, name: string) => {
    renameLayout(id, name);
    // saveConfig will be triggered by the store subscription in ViewEditorPage;
    // here we do it directly since we're on DisplayDetailPage
    const updatedLayouts = display.layouts.map((l) => l.id === id ? { ...l, name } : l);
    saveConfig({ layouts: updatedLayouts });
  };

  const handleToggleHidden = (id: string) => {
    toggleLayoutHidden(id);
    const updatedLayouts = display.layouts.map((l) => l.id === id ? { ...l, hidden: !l.hidden } : l);
    saveConfig({ layouts: updatedLayouts });
  };

  const visibleLayoutCount = display.layouts.filter((l) => !l.hidden).length;
  const navItems: Array<{ key: ManagementPage; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: 'views', label: 'Views', icon: IconLayoutGrid },
    { key: 'settings', label: 'Settings', icon: IconSettings },
    { key: 'theme', label: 'Themes', icon: IconPalette },
  ];

  return (
    <>
    <ShareDisplayModal
      opened={shareOpen}
      onClose={() => setShareOpen(false)}
      displayId={display.displayId}
      displayName={display.name}
    />
    {(display.isOwner ?? true) && accessToken && (
      <InviteModal
        opened={inviteOpen}
        onClose={() => setInviteOpen(false)}
        displayId={display.id}
        displayName={display.name}
        accessToken={accessToken}
      />
    )}

    {/* Alert: cannot delete last view */}
    <Modal
      opened={alertOpen}
      onClose={() => setAlertOpen(false)}
      title="Cannot delete view"
      size="sm"
      centered
    >
      <Text size="sm">You cannot delete the last view. Add another view before deleting this one.</Text>
      <Group justify="flex-end" mt="md">
        <Button onClick={() => setAlertOpen(false)}>OK</Button>
      </Group>
    </Modal>

    {/* Confirm: delete view */}
    <Modal
      opened={confirmDeleteId !== null}
      onClose={() => setConfirmDeleteId(null)}
      title="Delete view"
      size="sm"
      centered
    >
      <Text size="sm">Are you sure you want to delete this view? This cannot be undone.</Text>
      <Group justify="flex-end" mt="md" gap="sm">
        <Button variant="default" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
        <Button
          color="red"
          onClick={() => {
            if (confirmDeleteId) deleteLayout(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
        >
          Delete
        </Button>
      </Group>
    </Modal>

    {/* Prompt: new view name */}
    <Modal
      opened={newViewOpen}
      onClose={() => setNewViewOpen(false)}
      title="New view"
      size="sm"
      centered
    >
      <TextInput
        label="View name"
        value={newViewName}
        onChange={(e) => setNewViewName(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && newViewName.trim()) {
            createLayout(newViewName.trim());
            setNewViewOpen(false);
          }
          if (e.key === 'Escape') setNewViewOpen(false);
        }}
        autoFocus
        data-autofocus
      />
      <Group justify="flex-end" mt="md" gap="sm">
        <Button variant="default" onClick={() => setNewViewOpen(false)}>Cancel</Button>
        <Button
          disabled={!newViewName.trim()}
          onClick={() => {
            if (newViewName.trim()) {
              createLayout(newViewName.trim());
              setNewViewOpen(false);
            }
          }}
        >
          Create
        </Button>
      </Group>
    </Modal>
    <div className={classes.root}>
      <header className={classes.header}>
        <Group gap="md" wrap="nowrap">
          <Tooltip label="Back to displays">
            <ActionIcon variant="subtle" onClick={() => navigate('/displays')}>
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          {editingName ? (
            <Group gap={4}>
              <TextInput
                value={nameValue}
                onChange={(e) => setNameValue(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                size="sm"
                autoFocus
                w={200}
              />
              <ActionIcon variant="subtle" color="green" onClick={handleRename}><IconCheck size={16} /></ActionIcon>
              <ActionIcon variant="subtle" color="red" onClick={() => setEditingName(false)}><IconX size={16} /></ActionIcon>
            </Group>
          ) : (
            <Group gap={6}>
              <Title order={4} className={classes.title}>{display.name}</Title>
              <Tooltip label="Rename">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => { setNameValue(display.name); setEditingName(true); }}
                >
                  <IconEdit size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
          <Group gap={4} className={classes.topNav} wrap="nowrap">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <UnstyledButton
                  key={item.key}
                  className={`${classes.topNavItem} ${activePage === item.key ? classes.topNavItemActive : ''}`}
                  onClick={() => setActivePage(item.key)}
                >
                  <Icon size={15} />
                  <Text size="sm" fw={500}>{item.label}</Text>
                </UnstyledButton>
              );
            })}
          </Group>
        </Group>
        <Group gap="sm">
          {(display.isOwner ?? true) && (
            <Tooltip label="Invite collaborators">
              <ActionIcon variant="subtle" onClick={() => setInviteOpen(true)}>
                <IconUserPlus size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Share / QR code">
            <ActionIcon variant="subtle" onClick={() => setShareOpen(true)}>
              <IconShare size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <ActionIcon
              variant="subtle"
              onClick={() => {
                const next: ColorMode = colorMode === 'dark' ? 'light' : 'dark';
                setColorMode(display.id, next);
                saveConfig({ colorMode: next });
              }}
            >
              {colorMode === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Tooltip>
          <Menu position="bottom-end" withArrow shadow="md">
            <Menu.Target>
              <Tooltip label={user?.name ?? ''}>
                <Avatar
                  src={user?.picture}
                  alt={user?.name}
                  size="sm"
                  radius="xl"
                  style={{ cursor: 'pointer' }}
                />
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user?.email}</Menu.Label>
              <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={signOut}>
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </header>

      <main className={classes.main}>
        <section className={`${classes.content} ${activePage === 'theme' ? classes.themeContent : ''}`}>
          {activePage === 'views' && (
            <>
              <Group justify="space-between" mb="md">
                <Title order={5} className={classes.sectionTitle}>Views</Title>
                <Group gap="xs">
                  <Button
                    variant="light"
                    leftSection={<IconDeviceTv size={16} />}
                    onClick={() => openPreview({ displayId: display.displayId, forceRotation: true, colorMode })}
                  >
                    Preview Auto-Rotation
                  </Button>
                  <Button size="xs" variant="default" onClick={handleAddPresetViews}>
                    Add Preset Views
                  </Button>
                  <Button leftSection={<IconPlus size={14} />} size="xs" variant="light" onClick={handleNewView}>
                    New View
                  </Button>
                </Group>
              </Group>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={display.layouts.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <Stack gap="xs">
                    {display.layouts.map((layout) => (
                      <SortableViewCard
                        key={layout.id}
                        layout={layout}
                        onSelect={() => navigate(`/displays/${display.id}/views/${layout.id}`)}
                        onDelete={() => handleDeleteView(layout.id)}
                        onRename={(name) => handleRenameView(layout.id, name)}
                        onToggleHidden={() => handleToggleHidden(layout.id)}
                        onSetIcon={(icon) => setLayoutIcon(layout.id, icon)}
                      />
                    ))}
                  </Stack>
                </SortableContext>
              </DndContext>
            </>
          )}

          {activePage === 'settings' && (
            <Stack gap="lg">
              <section className={classes.section}>
                <Title order={5} className={classes.sectionTitle} mb="md">Viewer Passcode</Title>
                <Paper className={classes.settingsCard} p="md" radius="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Stack gap={2}>
                        <Group gap={6}>
                          {display.passcodeEnabled
                            ? <IconLock size={14} />
                            : <IconLockOpen size={14} />}
                          <Text size="sm" fw={500}>
                            {display.passcodeEnabled ? 'Passcode is set' : 'No passcode'}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          Require a 4-digit PIN before the display can be viewed
                        </Text>
                      </Stack>
                      {display.passcodeEnabled && (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          loading={pinSaving}
                          onClick={() => handleSavePin(null)}
                        >
                          Remove PIN
                        </Button>
                      )}
                    </Group>
                    <Stack gap={6}>
                      <Text size="xs" c="dimmed">
                        {display.passcodeEnabled ? 'Set a new PIN:' : 'Set a PIN:'}
                      </Text>
                      <Group gap="sm" align="flex-start">
                        <PinInput
                          length={4}
                          type="number"
                          value={pinInput}
                          onChange={(val) => { setPinInput(val); setPinError(null); }}
                          error={!!pinError}
                          placeholder="·"
                        />
                        <Button
                          size="sm"
                          disabled={pinInput.length !== 4}
                          loading={pinSaving}
                          onClick={() => handleSavePin(pinInput)}
                        >
                          {display.passcodeEnabled ? 'Change PIN' : 'Enable PIN'}
                        </Button>
                      </Group>
                      {pinError && <Text size="xs" c="red">{pinError}</Text>}
                    </Stack>
                  </Stack>
                </Paper>
              </section>

              <section className={classes.section}>
                <Title order={5} className={classes.sectionTitle} mb="md">Sticky Notes</Title>
                <Paper className={classes.settingsCard} p="md" radius="md">
                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>Enable sticky notes</Text>
                      <Text size="xs" c="dimmed">
                        Show a "+" button to add floating notes on each view - visible in editor and kiosk mode
                      </Text>
                    </Stack>
                    <Switch
                      checked={display.stickyNotesEnabled ?? false}
                      onChange={(e) => {
                        setStickyNotesEnabled(display.id, e.currentTarget.checked);
                        saveConfig({ stickyNotesEnabled: e.currentTarget.checked });
                      }}
                    />
                  </Group>
                </Paper>
              </section>

              <section className={classes.section}>
                <Title order={5} className={classes.sectionTitle} mb="md">Alarms</Title>
                <Paper className={classes.settingsCard} p="md" radius="md">
                  <Stack gap="sm">
                    <Text size="xs" c="dimmed">
                      Recurring alarms ring on this display with sound. Snooze for 5, 10, or 15 minutes.
                    </Text>
                    <AlarmListEditor
                      alarms={display.alarms ?? []}
                      onChange={(next) => {
                        setAlarms(display.id, next);
                        if (alarmsSaveDebounceRef.current) clearTimeout(alarmsSaveDebounceRef.current);
                        alarmsSaveDebounceRef.current = setTimeout(() => {
                          saveConfig({ alarms: next });
                        }, 500);
                      }}
                    />
                    <Group justify="space-between" mt="xs">
                      <Stack gap={2}>
                        <Text size="sm" fw={500}>Enable voice commands</Text>
                        <Text size="xs" c="dimmed">
                          Say dismiss or snooze when an alarm rings. Microphone permission is requested
                          on this display (Chromium / HTTPS recommended).
                        </Text>
                      </Stack>
                      <Switch
                        checked={display.voiceEnabled ?? false}
                        onChange={(e) => {
                          setVoiceEnabled(display.id, e.currentTarget.checked);
                          saveConfig({ voiceEnabled: e.currentTarget.checked });
                        }}
                      />
                    </Group>
                  </Stack>
                </Paper>
              </section>

              <section className={classes.section}>
                <Title order={5} className={classes.sectionTitle} mb="md">Holiday Effects</Title>
                <Paper className={classes.settingsCard} p="md" radius="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Stack gap={2}>
                        <Text size="sm" fw={500}>Enable holiday UI</Text>
                        <Text size="xs" c="dimmed">
                          Show holiday-specific visuals on matching dates (for example: St. Patrick&apos;s Day)
                        </Text>
                      </Stack>
                      <Switch
                        checked={display.holidayEffectsEnabled ?? false}
                        onChange={(e) => {
                          setHolidayEffectsEnabled(display.id, e.currentTarget.checked);
                          saveConfig({ holidayEffectsEnabled: e.currentTarget.checked });
                        }}
                      />
                    </Group>
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>Preview holiday</Text>
                      <Text size="xs" c="dimmed">
                        Force a holiday theme for testing. Auto uses the current date.
                      </Text>
                    </Stack>
                    <Select
                      data={[
                        { value: 'auto', label: 'Auto (today)' },
                        ...HOLIDAY_PREVIEW_OPTIONS,
                      ]}
                      value={display.holidayPreviewId ?? 'auto'}
                      onChange={(value) => {
                        const nextValue: HolidayId | undefined =
                          value && value !== 'auto' ? (value as HolidayId) : undefined;
                        setHolidayPreviewId(display.id, nextValue);
                        saveConfig({ holidayPreviewId: nextValue });
                      }}
                      size="sm"
                    />
                  </Stack>
                </Paper>
              </section>

              <section className={classes.section}>
                <Title order={5} className={classes.sectionTitle} mb="md">Auto-Rotate</Title>
                <Paper className={classes.settingsCard} p="md" radius="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Stack gap={2}>
                        <Text size="sm" fw={500}>Auto-rotate views</Text>
                        <Text size="xs" c="dimmed">Automatically cycle through visible views</Text>
                      </Stack>
                      <Switch
                        checked={display.rotationEnabled}
                        disabled={visibleLayoutCount <= 1}
                        onChange={(e) => {
                          setRotationEnabled(e.currentTarget.checked);
                          saveConfig({ rotationEnabled: e.currentTarget.checked });
                        }}
                      />
                    </Group>
                    {display.rotationEnabled && visibleLayoutCount > 1 && (
                      <Select
                        label="Rotation interval"
                        data={INTERVAL_OPTIONS}
                        value={String(display.rotationIntervalMs)}
                        onChange={(v) => {
                          if (!v) return;
                          setRotationIntervalMs(Number(v));
                          saveConfig({ rotationIntervalMs: Number(v) });
                        }}
                        size="sm"
                      />
                    )}
                    {visibleLayoutCount <= 1 && (
                      <Text size="xs" c="dimmed">
                        {display.layouts.length <= 1
                          ? 'Add a second view to enable auto-rotation'
                          : 'Show at least two views to enable auto-rotation'}
                      </Text>
                    )}
                  </Stack>
                </Paper>
              </section>
            </Stack>
          )}

          {activePage === 'theme' && (
            <section className={`${classes.section} ${classes.themeSection}`}>
              <ThemeDocumentManager
                documents={display.themes}
                activeThemeDocumentId={display.activeThemeId}
                previewLayouts={display.layouts}
                initialPreviewLayoutId={display.activeLayoutId}
                onChange={(themes, activeThemeId) => {
                  upsertDisplay({
                    ...display,
                    themes,
                    activeThemeId,
                  });
                  saveConfig({ themes, activeThemeId });
                }}
              />
            </section>
          )}
        </section>
      </main>
    </div>
    </>
  );
}
