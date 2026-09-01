import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Text, Stack, TextInput, NumberInput, Select, Switch, Button, Group,
  ActionIcon, Loader, Alert, Anchor, Progress, Image, SimpleGrid, Tooltip,
  Tabs,
} from '@mantine/core';
import { IconTrash, IconPlus, IconPhoto, IconBrandGoogle, IconUpload, IconLink, IconExternalLink, IconX } from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types';
import { useGooglePhotos } from '../hooks/useGooglePhotos';
import { useGoogleRuntime } from '../googleRuntime';
import { loadStoredImage } from '../services/googlePhotos';
import classes from './PhotoWidget.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A URL-based photo (no server storage needed — fetched directly in the browser). */
export interface UrlPhoto {
  type: 'url';
  url: string;
  caption?: string;
}

/** A photo stored in Netlify Blobs (from Google Photos picker or device upload). */
export interface StoredPhoto {
  type: 'stored';
  key: string;
  filename: string;
  caption?: string;
  /** Transient preview URL — populated at runtime, never persisted. */
  previewUrl?: string;
}

export type Photo = UrlPhoto | StoredPhoto;

export interface PhotoConfig extends WidgetConfig {
  photos: Photo[];
  interval: number;
  transition: 'fade' | 'slide' | 'none';
  showCaption: boolean;
  transparentBackground: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the displayable src for a photo (URL or pre-loaded blob URL). */
function photoSrc(photo: Photo): string | null {
  if (photo.type === 'url') return photo.url;
  return photo.previewUrl ?? null;
}

/** Upload a data-URL or remote URL to Netlify Blobs via /api/photo-upload. */
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

// ─── Display component ────────────────────────────────────────────────────────

// Sample photos shown when widget has no photos configured
const samplePhotos: UrlPhoto[] = [
  { type: 'url', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop', caption: 'Mountain Sunrise' },
  { type: 'url', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop', caption: 'Ocean Waves' },
  { type: 'url', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop', caption: 'Forest Path' },
  { type: 'url', url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&h=600&fit=crop', caption: 'Golden Fields' },
];

export function PhotoWidget({ widget }: WidgetProps<PhotoConfig>) {
  const { photos, interval, transition, showCaption, transparentBackground } = widget.config;

  const [resolvedPhotos, setResolvedPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  // Resolve stored photos to blob URLs
  useEffect(() => {
    if (photos.length === 0) {
      setResolvedPhotos(samplePhotos);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      const result: Photo[] = await Promise.all(
        photos.map(async (photo) => {
          if (photo.type === 'url') return photo;
          // Check if we already have a blob URL cached
          const cached = blobUrlsRef.current.get(photo.key);
          if (cached) return { ...photo, previewUrl: cached };
          try {
            const blobUrl = await loadStoredImage(photo.key);
            if (!cancelled) {
              blobUrlsRef.current.set(photo.key, blobUrl);
            }
            return { ...photo, previewUrl: blobUrl };
          } catch {
            return photo; // display nothing if load fails
          }
        })
      );
      if (!cancelled) setResolvedPhotos(result);
    };

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [photos]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    const blobUrls = blobUrlsRef.current;
    return () => {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.clear();
    };
  }, []);

  // Reset index when photo count changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [resolvedPhotos.length]);

  const nextPhoto = useCallback(() => {
    if (resolvedPhotos.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % resolvedPhotos.length);
      setIsTransitioning(false);
    }, 500);
  }, [resolvedPhotos.length]);

  useEffect(() => {
    if (resolvedPhotos.length <= 1) return;
    const timer = setInterval(nextPhoto, interval * 1000);
    return () => clearInterval(timer);
  }, [interval, nextPhoto, resolvedPhotos.length]);

  const currentPhoto = resolvedPhotos[currentIndex];
  const src = currentPhoto ? photoSrc(currentPhoto) : null;

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      {src ? (
        <div
          className={`${classes.photo} ${isTransitioning ? classes[transition] : ''}`}
          style={{ backgroundImage: `url(${src})` }}
        />
      ) : (
        <div className={classes.photo} />
      )}
      <div className={classes.overlay} />
      {showCaption && currentPhoto?.caption && (
        <div className={classes.caption}>
          <Text className={classes.captionText}>{currentPhoto.caption}</Text>
        </div>
      )}
      {resolvedPhotos.length > 1 && (
        <div className={classes.dots}>
          {resolvedPhotos.map((_, index) => (
            <button
              key={index}
              className={`${classes.dot} ${index === currentIndex ? classes.activeDot : ''}`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
      {photos.length === 0 && (
        <div className={classes.demoNotice}>
          <IconPhoto size={16} />
          <Text size="xs">Demo photos — add your own in settings</Text>
        </div>
      )}
    </Box>
  );
}

// ─── Photo thumbnail grid ─────────────────────────────────────────────────────

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
            {photo.caption && (
              <Text size="xs" className={classes.thumbCaption} lineClamp={1}>
                {photo.caption}
              </Text>
            )}
          </Box>
        );
      })}
    </SimpleGrid>
  );
}

// ─── Settings component ───────────────────────────────────────────────────────

const INTERVAL_PRESETS = [
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
];

export function PhotoWidgetSettings({ widget, onConfigChange }: WidgetProps<PhotoConfig>) {
  const { photos, interval, transition, showCaption } = widget.config;

  // URL tab state
  const [newUrl, setNewUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlUploading, setUrlUploading] = useState(false);

  // Upload tab state
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Photos tab
  const { isAuthenticated, isLoading: authLoading, signIn } = useGoogleRuntime();
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
  const lastSavedGoogleBatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (pickerStatus === 'ready' && storedImages.length > 0) {
      const batchKey = storedImages.map((img) => img.key).sort().join('|');
      if (lastSavedGoogleBatchRef.current === batchKey) return;
      lastSavedGoogleBatchRef.current = batchKey;

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
      lastSavedGoogleBatchRef.current = null;
    }
  }, [pickerStatus, storedImages, photos, onConfigChange]);

  // Remove a photo by index
  const removePhoto = (index: number) => {
    onConfigChange({ photos: photos.filter((_, i) => i !== index) });
  };

  // Add a URL photo — store on server to avoid CORS issues with CSS background-image
  const addUrlPhoto = async () => {
    if (!newUrl.trim()) return;
    setUrlError(null);
    setUrlUploading(true);
    try {
      const { key, filename } = await uploadPhoto({ url: newUrl.trim(), filename: newUrl.split('/').pop() });
      onConfigChange({
        photos: [...photos, { type: 'stored', key, filename, caption: newCaption.trim() || undefined }],
      });
      setNewUrl('');
      setNewCaption('');
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
            <TextInput
              placeholder="Caption (optional)"
              value={newCaption}
              onChange={(e) => setNewCaption(e.currentTarget.value)}
              size="sm"
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

      {/* Slideshow settings */}
      <Stack gap="sm" mt="xs">
        <Text size="sm" fw={500}>Slideshow</Text>
        <Stack gap="xs">
          <Text size="xs" c="dimmed">Interval</Text>
          <Group gap="xs" wrap="wrap">
            {INTERVAL_PRESETS.map(({ value, label }) => (
              <Button
                key={value}
                size="xs"
                variant={interval === value ? 'filled' : 'default'}
                onClick={() => onConfigChange({ interval: value })}
              >
                {label}
              </Button>
            ))}
            <Button
              size="xs"
              variant={!INTERVAL_PRESETS.some((p) => p.value === interval) ? 'filled' : 'default'}
              onClick={() => {
                if (INTERVAL_PRESETS.some((p) => p.value === interval)) {
                  onConfigChange({ interval: 20 });
                }
              }}
            >
              Custom
            </Button>
          </Group>
          {!INTERVAL_PRESETS.some((p) => p.value === interval) && (
            <NumberInput
              placeholder="Seconds"
              min={3}
              max={86400}
              value={interval}
              onChange={(value) => onConfigChange({ interval: Number(value) || 10 })}
              size="sm"
              w={160}
              suffix=" s"
            />
          )}
        </Stack>
        <Select
          label="Transition Effect"
          data={[
            { value: 'fade', label: 'Fade' },
            { value: 'slide', label: 'Slide' },
            { value: 'none', label: 'None' },
          ]}
          value={transition}
          onChange={(value) => onConfigChange({ transition: (value as PhotoConfig['transition']) || 'fade' })}
        />
        <Group justify="space-between">
          <Text size="sm">Show Caption</Text>
          <Switch
            checked={showCaption}
            onChange={(e) => onConfigChange({ showCaption: e.currentTarget.checked })}
          />
        </Group>
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
