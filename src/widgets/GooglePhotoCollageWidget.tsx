import { useEffect, useRef, useState } from 'react';
import {
  Box, Text, Stack, Button, Group, Loader, Alert, Anchor, NumberInput, Progress,
  Tabs, TextInput, ActionIcon, SimpleGrid, Image, Tooltip,
} from '@mantine/core';
import {
  IconLayoutGrid, IconBrandGoogle, IconUpload, IconLink, IconExternalLink,
  IconPlus, IconX, IconPhoto, IconTrash,
} from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useGooglePhotoCollage } from '../hooks/useGooglePhotoCollage';
import { useGooglePhotos } from '../hooks/useGooglePhotos';
import { useAuth } from '../contexts/AuthContext';
import { loadStoredImage } from '../services/googlePhotos';
import type { StoredImage } from '../services/googlePhotos';
import type { Photo, StoredPhoto } from './PhotoWidget';
import classes from './GooglePhotoCollageWidget.module.css';

export interface GooglePhotoCollageConfig extends WidgetConfig {
  rotationInterval: number;      // seconds between individual photo changes
  transparentBackground: boolean;
  photos: Photo[];
}

// ── Layout helpers ────────────────────────────────────────────────────────────

/**
 * Given pixel dimensions of the widget, compute how many masonry columns and
 * rows to use and the CSS grid-template-columns/rows strings.
 *
 * Strategy:
 *   - Target ~200px per cell (minimum)
 *   - cols = max(1, floor(width / 200))
 *   - rows = max(1, floor(height / 200))
 *   - slotCount = cols * rows
 */
function computeLayout(width: number, height: number) {
  const TARGET_CELL = 200;
  const cols = Math.max(1, Math.floor(width / TARGET_CELL));
  const rows = Math.max(1, Math.floor(height / TARGET_CELL));
  const slotCount = cols * rows;

  // Assign varying grid spans to make it feel masonry-like.
  // We tile a repeating pattern of span configurations.
  // For a 2-col grid: alternating tall/wide cells.
  // For 3+ cols: some cells span 2 columns or 2 rows.
  const spans = buildSpanPattern(cols, rows, slotCount);

  return { cols, rows, slotCount, spans };
}

interface CellSpan {
  colSpan: number;
  rowSpan: number;
}

/**
 * Produce a list of {colSpan, rowSpan} for `slotCount` cells that tile within
 * a `cols × rows` grid without overflowing. Uses a simple greedy packing
 * algorithm with a fixed pattern of "large" and "small" cells.
 */
function buildSpanPattern(cols: number, rows: number, slotCount: number): CellSpan[] {
  // For very small grids (1 cell) just fill.
  if (slotCount === 1) return [{ colSpan: 1, rowSpan: 1 }];

  // Build an occupancy grid
  const occupied = Array.from({ length: rows }, () => Array(cols).fill(false));

  function firstFree(): [number, number] | null {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!occupied[r][c]) return [r, c];
      }
    }
    return null;
  }

  function canPlace(r: number, c: number, rs: number, cs: number): boolean {
    if (r + rs > rows || c + cs > cols) return false;
    for (let dr = 0; dr < rs; dr++) {
      for (let dc = 0; dc < cs; dc++) {
        if (occupied[r + dr][c + dc]) return false;
      }
    }
    return true;
  }

  function place(r: number, c: number, rs: number, cs: number) {
    for (let dr = 0; dr < rs; dr++) {
      for (let dc = 0; dc < cs; dc++) {
        occupied[r + dr][c + dc] = true;
      }
    }
  }

  const result: CellSpan[] = [];

  // Candidates in priority order: try larger spans first for variety
  const candidates: [number, number][] =
    cols >= 3 && rows >= 3
      ? [[2, 2], [2, 1], [1, 2], [1, 1]]
      : cols >= 2 && rows >= 2
      ? [[2, 1], [1, 2], [1, 1]]
      : [[1, 1]];

  // Every ~4 cells insert a larger cell for variety; rest are 1×1
  let cellsPlaced = 0;

  while (result.length < slotCount) {
    const pos = firstFree();
    if (!pos) break;
    const [r, c] = pos;

    // Try a larger span every 3 placements for visual variety
    let placed = false;
    if (cellsPlaced % 3 === 0 && candidates[0][0] > 1) {
      for (const [rs, cs] of candidates) {
        if (rs === 1 && cs === 1) continue; // skip 1×1 in "large" turn
        if (canPlace(r, c, rs, cs)) {
          place(r, c, rs, cs);
          result.push({ colSpan: cs, rowSpan: rs });
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      place(r, c, 1, 1);
      result.push({ colSpan: 1, rowSpan: 1 });
    }

    cellsPlaced++;
  }

  return result;
}

// ── Upload helper (shared with PhotoWidget) ────────────────────────────────────

async function uploadPhoto(payload: { dataUrl?: string; url?: string; filename?: string }): Promise<{ key: string; filename: string }> {
  const res = await fetch('/api/photo-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<{ key: string; filename: string }>;
}

// ── Convert Photo[] to StoredImage[] for the collage hook ─────────────────────

function photosToStoredImages(photos: Photo[]): StoredImage[] {
  return photos
    .filter((p): p is StoredPhoto => p.type === 'stored')
    .map((p) => ({ key: p.key, filename: p.filename }));
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function GooglePhotoCollageWidget({ widget }: WidgetProps<GooglePhotoCollageConfig>) {
  const { rotationInterval, transparentBackground, photos } = widget.config;

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { cols, rows, slotCount, spans } = computeLayout(dimensions.width, dimensions.height);

  // Convert Photo[] to StoredImage[] for the collage hook (only stored photos are supported)
  const savedImages: StoredImage[] = photos && photos.length > 0 ? photosToStoredImages(photos) : [];

  const { pickerStatus, error, slots, transitioningSlot } =
    useGooglePhotoCollage({
      slotCount,
      rotationInterval: rotationInterval * 1000,
      savedImages,
    });

  const containerClass = `${classes.container} ${transparentBackground ? classes.transparent : ''}`;

  if (!photos || photos.length === 0) {
    return (
      <Box ref={containerRef} className={containerClass}>
        <div className={classes.stateContainer}>
          <IconLayoutGrid size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No Photos Selected</Text>
          <Text size="sm" c="dimmed" ta="center">
            Open widget settings to add photos to your collage
          </Text>
        </div>
      </Box>
    );
  }

  if (pickerStatus === 'uploading') {
    return (
      <Box ref={containerRef} className={containerClass}>
        <div className={classes.stateContainer}>
          <Loader size="lg" color="blue" />
          <Text size="sm" c="dimmed" mt="sm">Saving photos...</Text>
        </div>
      </Box>
    );
  }

  if (error) {
    return (
      <Box ref={containerRef} className={containerClass}>
        <Alert color="red" variant="light" m="sm">
          <Text size="sm">{error}</Text>
        </Alert>
      </Box>
    );
  }

  // Show loading state while resolving URLs
  if (savedImages.length === 0 && photos.length > 0) {
    return (
      <Box ref={containerRef} className={containerClass}>
        <div className={classes.stateContainer}>
          <Loader size="lg" color="blue" />
          <Text size="sm" c="dimmed" mt="sm">Loading photos...</Text>
        </div>
      </Box>
    );
  }

  // ── Photo grid ──────────────────────────────────────────────────────────────

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  };

  return (
    <Box ref={containerRef} className={containerClass}>
      <div className={classes.grid} style={gridStyle}>
        {slots.slice(0, slotCount).map((photo, idx) => {
          const span = spans[idx] ?? { colSpan: 1, rowSpan: 1 };
          const isFading = transitioningSlot === idx;

          return (
            <div
              key={idx}
              className={classes.cell}
              style={{
                gridColumn: `span ${span.colSpan}`,
                gridRow: `span ${span.rowSpan}`,
              }}
            >
              {photo ? (
                <div
                  className={`${classes.photo} ${isFading ? classes.fading : ''}`}
                  style={{ backgroundImage: `url(${photo.objectUrl})` }}
                />
              ) : (
                <div className={classes.photoSkeleton} />
              )}
            </div>
          );
        })}
      </div>
    </Box>
  );
}

// ── Thumbnail grid (settings) ─────────────────────────────────────────────────

interface PhotoThumbGridProps {
  photos: Photo[];
  onRemove: (index: number) => void;
}

function PhotoThumbGrid({ photos, onRemove }: PhotoThumbGridProps) {
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
            if (cached) {
              map.set(photo.key, cached);
              return;
            }
            try {
              const blobUrl = await loadStoredImage(photo.key);
              if (!cancelled) blobUrlsRef.current.set(photo.key, blobUrl);
              map.set(photo.key, blobUrl);
            } catch {
              // skip
            }
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
    return () => {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.clear();
    };
  }, []);

  if (photos.length === 0) return null;

  return (
    <SimpleGrid cols={3} spacing="xs">
      {photos.map((photo, index) => {
        const id = photo.type === 'url' ? photo.url : photo.key;
        const src = thumbUrls.get(id);
        return (
          <Box key={index} className={classes.thumbWrapper}>
            {src ? (
              <Image
                src={src}
                height={80}
                fit="cover"
                radius="sm"
                className={classes.thumb}
              />
            ) : (
              <Box className={classes.thumbPlaceholder}>
                <Loader size="xs" />
              </Box>
            )}
            <Tooltip label="Remove photo" position="top">
              <ActionIcon
                size="xs"
                color="red"
                variant="filled"
                className={classes.thumbRemove}
                onClick={() => onRemove(index)}
              >
                <IconX size={10} />
              </ActionIcon>
            </Tooltip>
          </Box>
        );
      })}
    </SimpleGrid>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

const ROTATION_PRESETS = [
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
  { value: 600, label: '10m' },
];
const ROTATION_PRESET_VALUES = ROTATION_PRESETS.map((p) => p.value);

export function GooglePhotoCollageWidgetSettings({
  widget,
  onConfigChange,
}: WidgetProps<GooglePhotoCollageConfig>) {
  const { rotationInterval, photos = [] } = widget.config;

  // URL tab state
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlUploading, setUrlUploading] = useState(false);

  // Upload tab state
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

  // When Google Photos picker completes, add the newly stored images as StoredPhotos
  const savedGoogleRef = useRef(false);
  useEffect(() => {
    if (pickerStatus === 'ready' && storedImages.length > 0 && !savedGoogleRef.current) {
      savedGoogleRef.current = true;
      const newPhotos: StoredPhoto[] = storedImages.map((img) => ({
        type: 'stored',
        key: img.key,
        filename: img.filename,
      }));
      // Avoid duplicates (by key)
      const existingKeys = new Set(
        photos.filter((p): p is StoredPhoto => p.type === 'stored').map((p) => p.key)
      );
      const toAdd = newPhotos.filter((p) => !existingKeys.has(p.key));
      if (toAdd.length > 0) {
        onConfigChange({ photos: [...photos, ...toAdd] });
      }
    }
    if (pickerStatus === 'idle') {
      savedGoogleRef.current = false;
    }
  }, [pickerStatus, storedImages, photos, onConfigChange]);

  const removePhoto = (index: number) => {
    onConfigChange({ photos: photos.filter((_, i) => i !== index) });
  };

  // Add a URL photo — store on server to avoid CORS issues
  const addUrlPhoto = async () => {
    if (!newUrl.trim()) return;
    setUrlError(null);
    setUrlUploading(true);
    try {
      const { key, filename } = await uploadPhoto({ url: newUrl.trim(), filename: newUrl.split('/').pop() });
      onConfigChange({
        photos: [...photos, { type: 'stored', key, filename } as StoredPhoto],
      });
      setNewUrl('');
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to add photo');
    } finally {
      setUrlUploading(false);
    }
  };

  // Handle device file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);

    const newPhotos: StoredPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setUploadError(`"${file.name}" is not an image file`);
        continue;
      }
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

    if (newPhotos.length > 0) {
      onConfigChange({ photos: [...photos, ...newPhotos] });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };



  return (
    <Stack gap="md">
      {/* Current photos */}
      {photos.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>Photos ({photos.length})</Text>
          <PhotoThumbGrid photos={photos} onRemove={removePhoto} />
        </Stack>
      )}

      {/* Add photos */}
      <Text size="sm" fw={500} mt={photos.length > 0 ? 'xs' : undefined}>Add Photos</Text>

      <Tabs defaultValue="url">
        <Tabs.List>
          <Tabs.Tab value="url" leftSection={<IconLink size={14} />}>URL</Tabs.Tab>
          <Tabs.Tab value="upload" leftSection={<IconUpload size={14} />}>Device</Tabs.Tab>
          <Tabs.Tab value="google" leftSection={<IconBrandGoogle size={14} />}>Google</Tabs.Tab>
        </Tabs.List>

        {/* URL tab */}
        <Tabs.Panel value="url" pt="sm">
          <Stack gap="xs">
            <TextInput
              placeholder="https://example.com/photo.jpg"
              value={newUrl}
              onChange={(e) => { setNewUrl(e.currentTarget.value); setUrlError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void addUrlPhoto(); }}
              size="sm"
              leftSection={<IconLink size={14} />}
            />
            {urlError && <Alert color="red" variant="light"><Text size="xs">{urlError}</Text></Alert>}
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => void addUrlPhoto()}
              disabled={!newUrl.trim()}
              loading={urlUploading}
              size="sm"
            >
              Add Photo
            </Button>
          </Stack>
        </Tabs.Panel>

        {/* Device upload tab */}
        <Tabs.Panel value="upload" pt="sm">
          <Stack gap="xs">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => void handleFileUpload(e.currentTarget.files)}
            />
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
              size="sm"
              variant="default"
            >
              {uploading ? 'Uploading...' : 'Choose Photos from Device'}
            </Button>
            {uploadError && <Alert color="red" variant="light"><Text size="xs">{uploadError}</Text></Alert>}
            <Text size="xs" c="dimmed">Supports JPEG, PNG, GIF, WebP. Max 20 MB per photo.</Text>
          </Stack>
        </Tabs.Panel>

        {/* Google Photos tab */}
        <Tabs.Panel value="google" pt="sm">
          <Stack gap="xs">
            {!isAuthenticated ? (
              <Stack align="flex-start" gap="sm">
                <Text size="sm" c="dimmed">Sign in to pick photos from Google Photos</Text>
                <Button
                  leftSection={<IconBrandGoogle size={16} />}
                  onClick={signIn}
                  loading={authLoading}
                  size="sm"
                >
                  Sign in with Google
                </Button>
              </Stack>
            ) : (
              <>
                <Text size="sm" c="dimmed">Connected to Google</Text>

                {pickerStatus === 'pending' && pickerUri && (
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">Select photos in Google Photos, then come back here.</Text>
                    <Anchor href={pickerUri} target="_blank" size="sm">
                      Open Google Photos <IconExternalLink size={12} />
                    </Anchor>
                  </Stack>
                )}

                {pickerStatus === 'uploading' && uploadProgress && (
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">Saving photos… {uploadProgress.done}/{uploadProgress.total}</Text>
                    <Progress value={(uploadProgress.done / uploadProgress.total) * 100} size="sm" animated />
                  </Stack>
                )}

                {googleError && (
                  <Alert color="red" variant="light"><Text size="sm">{googleError}</Text></Alert>
                )}

                <Group gap="xs">
                  <Button
                    size="sm"
                    leftSection={<IconPhoto size={16} />}
                    onClick={() => { void startPicker(); }}
                    loading={pickerStatus === 'pending' || pickerStatus === 'uploading'}
                    disabled={pickerStatus === 'pending' || pickerStatus === 'uploading'}
                  >
                    Pick Photos
                  </Button>
                  {storedImages.length > 0 && (
                    <Button size="sm" variant="subtle" color="red" onClick={clearGoogleSelection}>
                      Cancel
                    </Button>
                  )}
                </Group>
              </>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Rotation speed */}
      <Stack gap="xs">
        <Text size="sm" fw={500}>Rotation Speed</Text>
        <Text size="xs" c="dimmed">
          How often a single photo in the collage is replaced
        </Text>
        <Group gap="xs" wrap="wrap">
          {ROTATION_PRESETS.map(({ value, label }) => (
            <Button
              key={value}
              size="xs"
              variant={rotationInterval === value ? 'filled' : 'default'}
              onClick={() => onConfigChange({ rotationInterval: value })}
            >
              {label}
            </Button>
          ))}
          <Button
            size="xs"
            variant={!ROTATION_PRESET_VALUES.includes(rotationInterval) ? 'filled' : 'default'}
            onClick={() => {
              if (ROTATION_PRESET_VALUES.includes(rotationInterval)) {
                onConfigChange({ rotationInterval: 20 });
              }
            }}
          >
            Custom
          </Button>
        </Group>
        {!ROTATION_PRESET_VALUES.includes(rotationInterval) && (
          <NumberInput
            placeholder="Seconds"
            value={rotationInterval}
            onChange={(val) => {
              const num = typeof val === 'number' ? val : parseInt(String(val), 10);
              if (!isNaN(num) && num >= 5) onConfigChange({ rotationInterval: num });
            }}
            min={5}
            max={86400}
            size="sm"
            w={160}
            suffix=" s"
          />
        )}
      </Stack>

      {/* Remove all */}
      {photos.length > 0 && (
        <Button
          leftSection={<IconTrash size={16} />}
          color="red"
          variant="subtle"
          size="xs"
          onClick={() => onConfigChange({ photos: [] })}
        >
          Remove All Photos
        </Button>
      )}
    </Stack>
  );
}
