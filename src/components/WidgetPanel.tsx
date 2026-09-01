import { useEffect, useMemo, useRef, useState } from 'react';
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
  Tabs,
  Alert,
  Image,
  SimpleGrid,
  Loader,
  Progress,
  Anchor,
} from '@mantine/core';
import {
  IconChevronLeft, IconChevronRight, IconX, IconUpload, IconPhoto,
  IconLink, IconBrandGoogle, IconPlus, IconTrash, IconExternalLink,
} from '@tabler/icons-react';
import { getWidgetTypes, useGooglePhotos, loadStoredImage } from '@homeslate/widgets';
import { useDashboardStore } from '../store/dashboardStore';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';
import type { DashboardLayout } from '../types/widget';
import type { Photo, StoredPhoto } from '@homeslate/widgets';
import classes from './WidgetPanel.module.css';

// ── Upload helper ──────────────────────────────────────────────────────────────

async function uploadPhoto(payload: { dataUrl?: string; url?: string; filename?: string }): Promise<{ key: string; filename: string }> {
  return apiClient.post<{ key: string; filename: string }, { dataUrl?: string; url?: string; filename?: string }>(
    '/api/photo-upload',
    {
      body: payload,
    }
  );
}

// ── Interval presets ───────────────────────────────────────────────────────────

const INTERVAL_PRESETS = [
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
];
const INTERVAL_PRESET_VALUES = INTERVAL_PRESETS.map((p) => p.value);

// ── Thumbnail grid ─────────────────────────────────────────────────────────────

interface BgThumbGridProps {
  photos: Photo[];
  onRemove: (index: number) => void;
}

function BgThumbGrid({ photos, onRemove }: BgThumbGridProps) {
  const [thumbUrls, setThumbUrls] = useState<Map<string, string>>(new Map());
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const map = new Map<string, string>();
      await Promise.all(
        photos.map(async (photo) => {
          if (photo.type === 'url') {
            map.set(photo.url, photo.url);
          } else {
            const cached = blobUrlsRef.current.get(photo.key);
            if (cached) { map.set(photo.key, cached); return; }
            try {
              const blobUrl = await loadStoredImage(photo.key);
              if (!cancelled) blobUrlsRef.current.set(photo.key, blobUrl);
              map.set(photo.key, blobUrl);
            } catch { /* skip */ }
          }
        })
      );
      if (!cancelled) setThumbUrls(map);
    };
    void load();
    return () => { cancelled = true; };
  }, [photos]);

  useEffect(() => {
    const blobUrls = blobUrlsRef.current;
    return () => { blobUrls.forEach((u) => URL.revokeObjectURL(u)); blobUrls.clear(); };
  }, []);

  if (photos.length === 0) return null;

  return (
    <SimpleGrid cols={3} spacing={4}>
      {photos.map((photo, index) => {
        const id = photo.type === 'url' ? photo.url : photo.key;
        const src = thumbUrls.get(id);
        return (
          <Box key={index} pos="relative" style={{ borderRadius: 4, overflow: 'hidden', height: 52 }}>
            {src ? (
              <Image src={src} height={52} fit="cover" radius={0} />
            ) : (
              <Box style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--mantine-color-default-border)' }}>
                <Loader size="xs" />
              </Box>
            )}
            <ActionIcon
              pos="absolute"
              top={2} right={2}
              size="xs"
              color="red"
              variant="filled"
              style={{ opacity: 0.85 }}
              onClick={() => onRemove(index)}
            >
              <IconX size={8} />
            </ActionIcon>
          </Box>
        );
      })}
    </SimpleGrid>
  );
}

// ── Background settings panel ──────────────────────────────────────────────────

interface BgSettingsProps {
  view: DashboardLayout;
  updateBg: (updates: Partial<Pick<DashboardLayout, 'backgroundImage' | 'backgroundImageSize' | 'backgroundOverlayOpacity' | 'backgroundPhotos' | 'backgroundInterval'>>) => void;
}

export function BgSettings({ view, updateBg }: BgSettingsProps) {
  const photos: Photo[] = useMemo(() => view.backgroundPhotos ?? [], [view.backgroundPhotos]);
  const interval = view.backgroundInterval ?? 10;

  // URL tab
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlUploading, setUrlUploading] = useState(false);

  // Upload tab
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Photos tab
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth();
  const {
    pickerStatus,
    uploadProgress,
    error: googleError,
    pickerUri,
    storedImages,
    startPicker,
    clearSelection: clearGoogleSelection,
  } = useGooglePhotos({ savedImages: [] });

  // When Google picker completes, add photos
  const savedGoogleRef = useRef(false);
  useEffect(() => {
    if (pickerStatus === 'ready' && storedImages.length > 0 && !savedGoogleRef.current) {
      savedGoogleRef.current = true;
      const newPhotos: StoredPhoto[] = storedImages.map((img) => ({
        type: 'stored', key: img.key, filename: img.filename,
      }));
      const existingKeys = new Set(
        photos.filter((p): p is StoredPhoto => p.type === 'stored').map((p) => p.key)
      );
      const toAdd = newPhotos.filter((p) => !existingKeys.has(p.key));
      if (toAdd.length > 0) updateBg({ backgroundPhotos: [...photos, ...toAdd] });
    }
    if (pickerStatus === 'idle') savedGoogleRef.current = false;
  }, [pickerStatus, storedImages, photos, updateBg]);

  const removePhoto = (index: number) => {
    updateBg({ backgroundPhotos: photos.filter((_, i) => i !== index) });
  };

  const addUrlPhoto = async () => {
    if (!newUrl.trim()) return;
    setUrlError(null);
    setUrlUploading(true);
    try {
      const { key, filename } = await uploadPhoto({ url: newUrl.trim(), filename: newUrl.split('/').pop() });
      updateBg({ backgroundPhotos: [...photos, { type: 'stored', key, filename } as StoredPhoto] });
      setNewUrl('');
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to add photo');
    } finally {
      setUrlUploading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    const newPhotos: StoredPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { setUploadError(`"${file.name}" is not an image`); continue; }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        const { key, filename } = await uploadPhoto({ dataUrl, filename: file.name });
        newPhotos.push({ type: 'stored', key, filename });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : `Failed to upload "${file.name}"`);
      }
    }
    if (newPhotos.length > 0) updateBg({ backgroundPhotos: [...photos, ...newPhotos] });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasBackground = photos.length > 0 || !!view.backgroundImage;

  return (
    <Stack gap="xs">
      {/* Thumbnail strip */}
      {photos.length > 0 && (
        <BgThumbGrid photos={photos} onRemove={removePhoto} />
      )}

      {/* Legacy single backgroundImage preview */}
      {photos.length === 0 && view.backgroundImage && (
        <Box pos="relative" style={{ borderRadius: 6, overflow: 'hidden', height: 64 }}>
          <img
            src={view.backgroundImage}
            alt="Background preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <ActionIcon
            pos="absolute" top={4} right={4}
            size="sm" variant="filled" color="red"
            onClick={() => updateBg({ backgroundImage: undefined })}
          >
            <IconX size={12} />
          </ActionIcon>
        </Box>
      )}

      {/* Add photos tabs */}
      <Tabs defaultValue="url" variant="pills">
        <Tabs.List grow>
          <Tabs.Tab value="url" leftSection={<IconLink size={12} />}>URL</Tabs.Tab>
          <Tabs.Tab value="upload" leftSection={<IconUpload size={12} />}>Device</Tabs.Tab>
          <Tabs.Tab value="google" leftSection={<IconBrandGoogle size={12} />}>Google</Tabs.Tab>
        </Tabs.List>

        {/* URL tab */}
        <Tabs.Panel value="url" pt="xs">
          <Stack gap={4}>
            <Group gap={4}>
              <TextInput
                style={{ flex: 1 }}
                size="xs"
                placeholder="https://example.com/photo.jpg"
                value={newUrl}
                onChange={(e) => { setNewUrl(e.currentTarget.value); setUrlError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void addUrlPhoto(); }}
                leftSection={<IconPhoto size={12} />}
              />
              <Button
                size="xs"
                variant="default"
                disabled={!newUrl.trim()}
                loading={urlUploading}
                onClick={() => void addUrlPhoto()}
                px={8}
                leftSection={<IconPlus size={12} />}
              >
                Add
              </Button>
            </Group>
            {urlError && <Alert color="red" variant="light" p="xs"><Text size="xs">{urlError}</Text></Alert>}
          </Stack>
        </Tabs.Panel>

        {/* Device upload tab */}
        <Tabs.Panel value="upload" pt="xs">
          <Stack gap={4}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => void handleFileUpload(e.currentTarget.files)}
            />
            <Button
              size="xs"
              variant="default"
              leftSection={<IconUpload size={12} />}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
              fullWidth
            >
              {uploading ? 'Uploading…' : 'Choose from Device'}
            </Button>
            {uploadError && <Alert color="red" variant="light" p="xs"><Text size="xs">{uploadError}</Text></Alert>}
            <Text size="xs" c="dimmed">JPEG, PNG, GIF, WebP — max 20 MB</Text>
          </Stack>
        </Tabs.Panel>

        {/* Google Photos tab */}
        <Tabs.Panel value="google" pt="xs">
          <Stack gap={4}>
            {!isAuthenticated ? (
              <>
                <Text size="xs" c="dimmed">Sign in to pick from Google Photos</Text>
                <Button
                  size="xs"
                  leftSection={<IconBrandGoogle size={12} />}
                  loading={authLoading}
                  onClick={signIn}
                >
                  Sign in with Google
                </Button>
              </>
            ) : (
              <>
                <Text size="xs" c="dimmed">Connected to Google</Text>
                {pickerStatus === 'pending' && pickerUri && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Select photos, then come back here.</Text>
                    <Anchor href={pickerUri} target="_blank" size="xs">
                      Open Google Photos <IconExternalLink size={10} />
                    </Anchor>
                  </Stack>
                )}
                {pickerStatus === 'uploading' && uploadProgress && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Saving… {uploadProgress.done}/{uploadProgress.total}</Text>
                    <Progress value={(uploadProgress.done / uploadProgress.total) * 100} size="xs" animated />
                  </Stack>
                )}
                {googleError && <Alert color="red" variant="light" p="xs"><Text size="xs">{googleError}</Text></Alert>}
                <Group gap={4}>
                  <Button
                    size="xs"
                    leftSection={<IconPhoto size={12} />}
                    loading={pickerStatus === 'pending' || pickerStatus === 'uploading'}
                    disabled={pickerStatus === 'pending' || pickerStatus === 'uploading'}
                    onClick={() => void startPicker()}
                  >
                    Pick Photos
                  </Button>
                  {storedImages.length > 0 && (
                    <Button size="xs" variant="subtle" color="red" onClick={clearGoogleSelection}>Cancel</Button>
                  )}
                </Group>
              </>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Interval (only when multiple photos) */}
      {photos.length > 1 && (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">Slideshow interval</Text>
          <Group gap={4} wrap="wrap">
            {INTERVAL_PRESETS.map(({ value, label }) => (
              <Button
                key={value}
                size="xs"
                variant={interval === value ? 'filled' : 'default'}
                onClick={() => updateBg({ backgroundInterval: value })}
              >
                {label}
              </Button>
            ))}
            <Button
              size="xs"
              variant={!INTERVAL_PRESET_VALUES.includes(interval) ? 'filled' : 'default'}
              onClick={() => { if (INTERVAL_PRESET_VALUES.includes(interval)) updateBg({ backgroundInterval: 20 }); }}
            >
              Custom
            </Button>
          </Group>
          {!INTERVAL_PRESET_VALUES.includes(interval) && (
            <TextInput
              size="xs"
              placeholder="Seconds"
              value={String(interval)}
              onChange={(e) => {
                const num = parseInt(e.currentTarget.value, 10);
                if (!isNaN(num) && num >= 3) updateBg({ backgroundInterval: num });
              }}
              w={100}
              rightSection={<Text size="xs" c="dimmed">s</Text>}
            />
          )}
        </Stack>
      )}

      {/* Fit + Overlay (only when there's a background) */}
      {hasBackground && (
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

      {/* Remove all */}
      {photos.length > 0 && (
        <Button
          size="xs"
          variant="subtle"
          color="red"
          leftSection={<IconTrash size={12} />}
          onClick={() => updateBg({ backgroundPhotos: [] })}
        >
          Remove All
        </Button>
      )}
    </Stack>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function WidgetPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const { addWidget } = useDashboardStore();
  const widgetTypes = getWidgetTypes();

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
        </div>
      )}
    </aside>
  );
}
