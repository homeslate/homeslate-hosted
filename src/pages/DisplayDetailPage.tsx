import { useState, useRef } from 'react';
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
} from '@mantine/core';
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
} from '@tabler/icons-react';
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
import { ShareDisplayModal } from '../components/ShareDisplayModal';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStore } from '../store/dashboardStore';
import { ThemePicker } from '../components/ThemePicker';
import type { DisplayTheme } from '../types/theme';
import type { DashboardLayout } from '../types/widget';
import classes from './DisplayDetailPage.module.css';

const INTERVAL_OPTIONS = [
  { value: '15000',   label: '15 seconds' },
  { value: '30000',   label: '30 seconds' },
  { value: '60000',   label: '1 minute'   },
  { value: '300000',  label: '5 minutes'  },
  { value: '600000',  label: '10 minutes' },
  { value: '1800000', label: '30 minutes' },
];

// ─── Sortable view card ────────────────────────────────────────────────────────

interface ViewCardProps {
  layout: DashboardLayout;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onToggleHidden: () => void;
}

function SortableViewCard({ layout, onSelect, onDelete, onRename, onToggleHidden }: ViewCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: layout.id,
  });
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(layout.name);
  const inputRef = useRef<HTMLInputElement>(null);

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
    </Paper>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function DisplayDetailPage() {
  const { user, accessToken, signOut } = useAuth();
  const {
    displays,
    selectedDisplayId,
    selectDisplay,
    selectView,
    renameDisplay,
    createLayout,
    deleteLayout,
    renameLayout,
    reorderLayouts,
    toggleLayoutHidden,
    setRotationEnabled,
    setRotationIntervalMs,
    setDisplayTheme,
    setPasscodeEnabled,
  } = useDashboardStore();
  const display = displays.find((d) => d.id === selectedDisplayId);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(display?.name ?? '');
  const [shareOpen, setShareOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (!display) return null;

  const saveConfig = (overrides: Partial<typeof display> = {}) => {
    if (!accessToken) return;
    const { layouts, activeLayoutId, rotationEnabled, rotationIntervalMs, theme: displayTheme } = {
      ...display,
      ...overrides,
    };
    fetch(`/api/config?displayId=${display.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ layouts, activeLayoutId, rotationEnabled, rotationIntervalMs, theme: displayTheme }),
    }).catch(console.error);
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
      fetch(`/api/displays?id=${display.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmed }),
      }).catch(console.error);
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
      const res = await fetch(`/api/displays?id=${display.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passcode: pin }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setPinError(err.error ?? 'Failed to save passcode');
        return;
      }
      setPasscodeEnabled(display.id, pin !== null);
      setPinInput('');
    } catch {
      setPinError('Network error');
    } finally {
      setPinSaving(false);
    }
  };

  const handleNewView = () => {
    const name = prompt('View name:', 'New View');
    if (name?.trim()) createLayout(name.trim());
  };

  const handleDeleteView = (id: string) => {
    if (display.layouts.length <= 1) {
      alert('Cannot delete the last view.');
      return;
    }
    if (confirm('Delete this view?')) deleteLayout(id);
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

  return (
    <>
    <ShareDisplayModal
      opened={shareOpen}
      onClose={() => setShareOpen(false)}
      displayId={display.displayId}
      displayName={display.name}
    />
    <div className={classes.root}>
      <header className={classes.header}>
        <Group gap="sm">
          <Tooltip label="Back to displays">
            <ActionIcon variant="subtle" onClick={() => selectDisplay(null)}>
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
        </Group>
        <Group gap="sm">
          <Tooltip label="Share / QR code">
            <ActionIcon variant="subtle" onClick={() => setShareOpen(true)}>
              <IconShare size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Open display preview in new tab">
            <ActionIcon
              variant="subtle"
              onClick={() => window.open(`/?display=${display.displayId}`, '_blank')}
            >
              <IconDeviceTv size={18} />
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
        {/* Views section */}
        <section className={classes.section}>
          <Group justify="space-between" mb="md">
            <Title order={5} className={classes.sectionTitle}>Views</Title>
            <Button leftSection={<IconPlus size={14} />} size="xs" variant="light" onClick={handleNewView}>
              New View
            </Button>
          </Group>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={display.layouts.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs">
                {display.layouts.map((layout) => (
                  <SortableViewCard
                    key={layout.id}
                    layout={layout}
                    onSelect={() => selectView(layout.id)}
                    onDelete={() => handleDeleteView(layout.id)}
                    onRename={(name) => handleRenameView(layout.id, name)}
                    onToggleHidden={() => handleToggleHidden(layout.id)}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        </section>

        {/* Settings section */}
        <section className={classes.section}>
          <Title order={5} className={classes.sectionTitle} mb="md">Settings</Title>
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

        {/* Viewer Passcode section */}
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

        {/* Theme section */}
        <section className={classes.section}>
          <Title order={5} className={classes.sectionTitle} mb="md">Theme</Title>
          <ThemePicker
            value={display.theme}
            onChange={(theme: DisplayTheme) => {
              setDisplayTheme(display.id, theme);
              saveConfig({ theme });
            }}
          />
        </section>
      </main>
    </div>
    </>
  );
}
