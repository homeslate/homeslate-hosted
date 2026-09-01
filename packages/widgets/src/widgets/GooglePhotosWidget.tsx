import { useEffect, useRef } from 'react';
import { Box, Text, Stack, Switch, Button, Group, Loader, Alert, Anchor, Progress } from '@mantine/core';
import { IconBrandGoogle, IconPhoto, IconExternalLink } from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types';
import { useGooglePhotos } from '../hooks/useGooglePhotos';
import { useGoogleRuntime } from '../googleRuntime';
import type { StoredImage } from '../services/googlePhotos';
import classes from './GooglePhotosWidget.module.css';

export interface GooglePhotosConfig extends WidgetConfig {
  showCaption: boolean;
  refreshInterval: number;
  transparentBackground: boolean;
  savedImages?: StoredImage[];
}

export function GooglePhotosWidget({ widget }: WidgetProps<GooglePhotosConfig>) {
  const { refreshInterval, transparentBackground, savedImages } = widget.config;

  const {
    isAuthenticated,
    pickerStatus,
    error,
    pickerUri,
    currentPhoto,
  } = useGooglePhotos({
    refreshInterval: refreshInterval * 1000,
    savedImages,
  });

  if (!isAuthenticated && pickerStatus === 'idle') {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.signIn}>
          <IconBrandGoogle size={48} className={classes.googleIcon} />
          <Text size="lg" fw={500} mb="xs">Google Photos</Text>
          <Text size="sm" c="dimmed" ta="center">
            Sign in using the button in the header to view your photos
          </Text>
        </div>
      </Box>
    );
  }

  if (pickerStatus === 'idle') {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <IconPhoto size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No Photos Selected</Text>
          <Text size="sm" c="dimmed" ta="center">
            Open widget settings to pick photos from Google Photos
          </Text>
        </div>
      </Box>
    );
  }

  if (pickerStatus === 'pending') {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.loading}>
          <Loader size="lg" color="blue" />
          <Text size="sm" c="dimmed" ta="center">
            Waiting for you to select photos in Google Photos...
          </Text>
          {pickerUri && (
            <Anchor href={pickerUri} target="_blank" size="sm">
              Open Google Photos picker <IconExternalLink size={12} />
            </Anchor>
          )}
        </div>
      </Box>
    );
  }

  if (pickerStatus === 'uploading') {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.loading}>
          <Loader size="lg" color="blue" />
          <Text size="sm" c="dimmed">Saving selected photos...</Text>
        </div>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <Alert color="red" variant="light">
          <Text size="sm">{error}</Text>
        </Alert>
      </Box>
    );
  }

  if (!currentPhoto) {
    return (
      <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
        <div className={classes.empty}>
          <IconPhoto size={48} className={classes.emptyIcon} />
          <Text size="lg" fw={500}>No Photos</Text>
          <Text size="sm" c="dimmed" ta="center">No images found in your selection</Text>
        </div>
      </Box>
    );
  }

  return (
    <Box className={`${classes.container} ${transparentBackground ? classes.transparent : ''}`}>
      <div
        className={classes.photo}
        style={{ backgroundImage: `url(${currentPhoto.objectUrl})` }}
      />
      <div className={classes.overlay} />
    </Box>
  );
}

export function GooglePhotosWidgetSettings({
  widget,
  onConfigChange,
}: WidgetProps<GooglePhotosConfig>) {
  const { showCaption, refreshInterval, savedImages } = widget.config;

  const { isAuthenticated, isLoading, signIn } = useGoogleRuntime();
  const {
    pickerStatus,
    uploadProgress,
    error,
    pickerUri,
    storedImages,
    startPicker,
    clearSelection,
  } = useGooglePhotos({ savedImages });

  const hasSelection = storedImages.length > 0;

  // Persist stored images to widget config once when a new selection completes.
  const savedRef = useRef(false);
  useEffect(() => {
    if (pickerStatus === 'ready' && storedImages.length > 0 && !savedRef.current) {
      savedRef.current = true;
      onConfigChange({ savedImages: storedImages });
    }
    if (pickerStatus === 'idle') {
      savedRef.current = false;
    }
  }, [pickerStatus, storedImages, onConfigChange]);

  return (
    <Stack gap="md">
      <Box className={classes.authSection}>
        {isAuthenticated ? (
          <Text size="sm" c="dimmed">Connected to Google</Text>
        ) : (
          <Stack align="center" gap="sm">
            <Text size="sm" c="dimmed">Sign in to select your photos</Text>
            <Button
              leftSection={<IconBrandGoogle size={16} />}
              onClick={signIn}
              loading={isLoading}
              size="sm"
            >
              Sign in with Google
            </Button>
          </Stack>
        )}
      </Box>

      {isAuthenticated && (
        <>
          <Stack gap="xs">
            <Text size="sm" fw={500}>Photo Selection</Text>

            {hasSelection && (
              <Text size="sm" c="dimmed">
                {storedImages.length} photo{storedImages.length !== 1 ? 's' : ''} saved
              </Text>
            )}

            {pickerStatus === 'pending' && pickerUri && (
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  Select photos in Google Photos, then come back here.
                </Text>
                <Anchor href={pickerUri} target="_blank" size="sm">
                  Open Google Photos <IconExternalLink size={12} />
                </Anchor>
              </Stack>
            )}

            {pickerStatus === 'uploading' && uploadProgress && (
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  Saving photos… {uploadProgress.done}/{uploadProgress.total}
                </Text>
                <Progress
                  value={(uploadProgress.done / uploadProgress.total) * 100}
                  size="sm"
                  animated
                />
              </Stack>
            )}

            {error && (
              <Alert color="red" variant="light">
                <Text size="sm">{error}</Text>
              </Alert>
            )}

            <Group gap="xs">
              <Button
                size="sm"
                leftSection={<IconPhoto size={16} />}
                onClick={() => { void startPicker(); }}
                loading={pickerStatus === 'pending' || pickerStatus === 'uploading'}
                disabled={pickerStatus === 'pending' || pickerStatus === 'uploading'}
              >
                {hasSelection ? 'Change Photos' : 'Pick Photos'}
              </Button>

              {hasSelection && (
                <Button
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => {
                    clearSelection();
                    onConfigChange({ savedImages: [] });
                  }}
                >
                  Clear
                </Button>
              )}
            </Group>
          </Stack>

          <Group justify="space-between">
            <Text size="sm">Show Caption</Text>
            <Switch
              checked={showCaption}
              onChange={(e) => onConfigChange({ showCaption: e.currentTarget.checked })}
            />
          </Group>

          <Stack gap="xs">
            <Text size="sm" fw={500}>Refresh Interval</Text>
            <Group gap="xs" wrap="wrap">
              {[
                { value: 30, label: '30s' },
                { value: 60, label: '1m' },
                { value: 300, label: '5m' },
                { value: 600, label: '10m' },
                { value: 1800, label: '30m' },
                { value: 3600, label: '1h' },
              ].map(({ value, label }) => (
                <Button
                  key={value}
                  size="xs"
                  variant={refreshInterval === value ? 'filled' : 'default'}
                  onClick={() => onConfigChange({ refreshInterval: value })}
                >
                  {label}
                </Button>
              ))}
            </Group>
          </Stack>
        </>
      )}
    </Stack>
  );
}
