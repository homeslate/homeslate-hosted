import { useRef, useState } from 'react';
import {
  Stack,
  Text,
  UnstyledButton,
  Tooltip,
  ActionIcon,
  Group,
  Button,
  TextInput,
  Select,
  Slider,
  Box,
  LoadingOverlay,
  Divider,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX, IconUpload, IconPhoto } from '@tabler/icons-react';
import { getWidgetTypes } from '../widgets/registry';
import { useDashboardStore } from '../store/dashboardStore';
import type { DashboardLayout } from '../types/widget';
import classes from './WidgetPanel.module.css';

export function WidgetPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { addWidget, setLayoutBackground, displays, selectedDisplayId, selectedViewId } = useDashboardStore();
  const widgetTypes = getWidgetTypes();

  const display = displays.find((d) => d.id === selectedDisplayId);
  const view = display?.layouts.find((l) => l.id === selectedViewId);

  const updateBg = (updates: Partial<Pick<DashboardLayout, 'backgroundImage' | 'backgroundImageSize' | 'backgroundOverlayOpacity'>>) => {
    if (!selectedViewId) return;
    setLayoutBackground(selectedViewId, updates as Parameters<typeof setLayoutBackground>[1]);
  };

  const uploadImageFile = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/photo-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename: file.name }),
      });
      if (res.ok) {
        const { key } = (await res.json()) as { key: string };
        updateBg({ backgroundImage: `/api/photo-proxy?key=${key}` });
      }
    } finally {
      setUploading(false);
    }
  };

  const uploadImageUrl = async (url: string) => {
    if (!url.trim()) return;
    setUploading(true);
    try {
      const res = await fetch('/api/photo-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const { key } = (await res.json()) as { key: string };
        updateBg({ backgroundImage: `/api/photo-proxy?key=${key}` });
        setUrlInput('');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleAddWidget = (type: string) => {
    const widgetDef = widgetTypes.find((w) => w.type === type);
    if (widgetDef) {
      addWidget(type, widgetDef.defaultConfig, {
        x: 0,
        y: 0,
        w: widgetDef.defaultLayout.w,
        h: widgetDef.defaultLayout.h,
        minW: widgetDef.defaultLayout.minW,
        minH: widgetDef.defaultLayout.minH,
        maxW: widgetDef.defaultLayout.maxW,
        maxH: widgetDef.defaultLayout.maxH,
      });
    }
  };

  return (
    <aside className={`${classes.panel} ${collapsed ? classes.collapsed : ''}`}>
      <div className={classes.toggleBar}>
        <ActionIcon
          variant="subtle"
          onClick={() => setCollapsed((c) => !c)}
          className={classes.toggleBtn}
          title={collapsed ? 'Expand widget panel' : 'Collapse widget panel'}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
        </ActionIcon>
      </div>

      {collapsed ? (
        <Stack gap={4} align="center" pt="xs">
          {widgetTypes.map((widget) => {
            const Icon = widget.icon;
            return (
              <Tooltip key={widget.type} label={widget.name} position="right">
                <UnstyledButton
                  className={classes.iconOnly}
                  onClick={() => handleAddWidget(widget.type)}
                >
                  <Icon size={20} />
                </UnstyledButton>
              </Tooltip>
            );
          })}
        </Stack>
      ) : (
        <div className={classes.content}>
          <Text size="xs" fw={600} c="dimmed" className={classes.panelTitle}>
            ADD WIDGETS
          </Text>
          <Stack gap={2}>
            {widgetTypes.map((widget) => {
              const Icon = widget.icon;
              return (
                <UnstyledButton
                  key={widget.type}
                  className={classes.widgetRow}
                  onClick={() => handleAddWidget(widget.type)}
                >
                  <div className={classes.widgetIcon}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <Text size="sm" fw={500}>{widget.name}</Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>{widget.description}</Text>
                  </div>
                </UnstyledButton>
              );
            })}
          </Stack>

          <Divider my="md" />

          <Text size="xs" fw={600} c="dimmed" className={classes.panelTitle}>
            VIEW BACKGROUND
          </Text>
          <Stack gap="xs">
            {view?.backgroundImage && (
              <Box pos="relative" style={{ borderRadius: 6, overflow: 'hidden', height: 64 }}>
                <img
                  src={view.backgroundImage}
                  alt="Background preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <ActionIcon
                  pos="absolute"
                  top={4}
                  right={4}
                  size="sm"
                  variant="filled"
                  color="red"
                  onClick={() => updateBg({ backgroundImage: undefined })}
                >
                  <IconX size={12} />
                </ActionIcon>
              </Box>
            )}
            <Box pos="relative">
              <LoadingOverlay visible={uploading} zIndex={10} overlayProps={{ radius: 'sm', blur: 2 }} />
              <Stack gap={4}>
                <Group gap={4}>
                  <TextInput
                    style={{ flex: 1 }}
                    size="xs"
                    placeholder="Paste image URL…"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') uploadImageUrl(urlInput); }}
                    leftSection={<IconPhoto size={12} />}
                  />
                  <Button
                    size="xs"
                    variant="default"
                    disabled={!urlInput.trim()}
                    onClick={() => uploadImageUrl(urlInput)}
                    px={8}
                  >
                    Set
                  </Button>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconUpload size={12} />}
                  onClick={() => fileRef.current?.click()}
                  fullWidth
                >
                  Upload image
                </Button>
              </Stack>
            </Box>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImageFile(file);
                e.target.value = '';
              }}
            />
            {view?.backgroundImage && (
              <>
                <Select
                  size="xs"
                  data={[
                    { value: 'cover', label: 'Cover (fill screen)' },
                    { value: 'contain', label: 'Contain (fit inside)' },
                    { value: 'tile', label: 'Tile (repeat)' },
                  ]}
                  value={view.backgroundImageSize ?? 'cover'}
                  onChange={(v) => v && updateBg({ backgroundImageSize: v as DashboardLayout['backgroundImageSize'] })}
                />
                <Stack gap={2}>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Overlay darkness</Text>
                    <Text size="xs" c="dimmed">{Math.round((view.backgroundOverlayOpacity ?? 0.5) * 100)}%</Text>
                  </Group>
                  <Slider
                    value={(view.backgroundOverlayOpacity ?? 0.5) * 100}
                    onChange={(v) => updateBg({ backgroundOverlayOpacity: v / 100 })}
                    min={0}
                    max={90}
                    step={5}
                    size="xs"
                  />
                </Stack>
              </>
            )}
          </Stack>
        </div>
      )}
    </aside>
  );
}
