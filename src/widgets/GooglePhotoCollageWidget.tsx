import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Text, Stack, Switch, Button, Group, Loader, Alert, Anchor, NumberInput } from '@mantine/core';
import { IconBrandGoogle, IconLayoutGrid, IconExternalLink } from '@tabler/icons-react';
import type { WidgetProps, WidgetConfig } from '../types/widget';
import { useGooglePhotoCollage } from '../hooks/useGooglePhotoCollage';
import { useAuth } from '../contexts/AuthContext';
import type { PickedMediaItem } from '../services/googlePhotos';
import classes from './GooglePhotoCollageWidget.module.css';

export interface GooglePhotoCollageConfig extends WidgetConfig {
  rotationInterval: number;      // seconds between individual photo changes
  transparentBackground: boolean;
  savedMediaItems?: PickedMediaItem[];
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

// ── Main widget ───────────────────────────────────────────────────────────────

export function GooglePhotoCollageWidget({ widget }: WidgetProps<GooglePhotoCollageConfig>) {
  const { rotationInterval, transparentBackground, savedMediaItems } = widget.config;

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

  const { isAuthenticated, pickerStatus, error, pickerUri, slots, transitioningSlot } =
    useGooglePhotoCollage({
      slotCount,
      rotationInterval: rotationInterval * 1000,
      savedMediaItems,
    });

  const containerClass = `${classes.container} ${transparentBackground ? classes.transparent : ''}`;

  if (!isAuthenticated) {
    return (
      <Box ref={containerRef} className={containerClass}>
        <div className={classes.stateContainer}>
          <IconBrandGoogle size={48} className={classes.googleIcon} />
          <Text size="lg" fw={500} mb="xs">Google Photos Collage</Text>
          <Text size="sm" c="dimmed" ta="center">
            Sign in using the button in the header to view your photos
          </Text>
        </div>
      </Box>
    );
  }

  if (pickerStatus === 'idle') {
    return (
      <Box ref={containerRef} className={containerClass}>
        <div className={classes.stateContainer}>
          <IconLayoutGrid size={48} className={classes.emptyIcon} />
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
      <Box ref={containerRef} className={containerClass}>
        <div className={classes.stateContainer}>
          <Loader size="lg" color="blue" />
          <Text size="sm" c="dimmed" ta="center" mt="sm">
            Waiting for you to select photos in Google Photos...
          </Text>
          {pickerUri && (
            <Anchor href={pickerUri} target="_blank" size="sm" mt="xs">
              Open Google Photos picker <IconExternalLink size={12} />
            </Anchor>
          )}
        </div>
      </Box>
    );
  }

  if (pickerStatus === 'loading') {
    return (
      <Box ref={containerRef} className={containerClass}>
        <div className={classes.stateContainer}>
          <Loader size="lg" color="blue" />
          <Text size="sm" c="dimmed" mt="sm">Loading photos...</Text>
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
                // Skeleton while loading
                <div className={classes.photo} style={{ background: '#2c2e33' }} />
              )}
            </div>
          );
        })}
      </div>
    </Box>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function GooglePhotoCollageWidgetSettings({
  widget,
  onConfigChange,
}: WidgetProps<GooglePhotoCollageConfig>) {
  const { rotationInterval, savedMediaItems } = widget.config;

  const { isAuthenticated, isLoading, signIn } = useAuth();

  // Dummy slotCount for settings panel — actual count is determined at runtime
  const { pickerStatus, error, pickerUri, mediaItems, startPicker, clearSelection } =
    useGooglePhotoCollage({ slotCount: 1, savedMediaItems });

  const hasSelection = mediaItems.length > 0;

  // Persist media items once selection completes
  const savedRef = useRef(false);
  useEffect(() => {
    if (pickerStatus === 'ready' && mediaItems.length > 0 && !savedRef.current) {
      savedRef.current = true;
      onConfigChange({ savedMediaItems: mediaItems });
    }
    if (pickerStatus === 'idle') {
      savedRef.current = false;
    }
  }, [pickerStatus, mediaItems, onConfigChange]);

  const [intervalInput, setIntervalInput] = useState<string | number>(rotationInterval);

  const handleIntervalChange = useCallback(
    (val: string | number) => {
      setIntervalInput(val);
      const num = typeof val === 'number' ? val : parseInt(val, 10);
      if (!isNaN(num) && num >= 5) {
        onConfigChange({ rotationInterval: num });
      }
    },
    [onConfigChange]
  );

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
                {mediaItems.length} photo{mediaItems.length !== 1 ? 's' : ''} selected
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

            {pickerStatus === 'loading' && (
              <Group gap="xs">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">Loading your photos...</Text>
              </Group>
            )}

            {error && (
              <Alert color="red" variant="light">
                <Text size="sm">{error}</Text>
              </Alert>
            )}

            <Group gap="xs">
              <Button
                size="sm"
                leftSection={<IconLayoutGrid size={16} />}
                onClick={() => { void startPicker(); }}
                loading={pickerStatus === 'pending' || pickerStatus === 'loading'}
                disabled={pickerStatus === 'pending' || pickerStatus === 'loading'}
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
                    onConfigChange({ savedMediaItems: [] });
                  }}
                >
                  Clear
                </Button>
              )}
            </Group>
          </Stack>

          <Stack gap="xs">
            <Text size="sm" fw={500}>Rotation Speed</Text>
            <Text size="xs" c="dimmed">
              How often a single photo in the collage is replaced (seconds)
            </Text>
            <Group gap="xs" wrap="wrap">
              {[
                { value: 5, label: '5s' },
                { value: 10, label: '10s' },
                { value: 30, label: '30s' },
                { value: 60, label: '1m' },
                { value: 300, label: '5m' },
                { value: 600, label: '10m' },
              ].map(({ value, label }) => (
                <Button
                  key={value}
                  size="xs"
                  variant={rotationInterval === value ? 'filled' : 'default'}
                  onClick={() => onConfigChange({ rotationInterval: value })}
                >
                  {label}
                </Button>
              ))}
            </Group>
            <NumberInput
              label="Custom (seconds)"
              value={intervalInput}
              onChange={handleIntervalChange}
              min={5}
              max={86400}
              size="sm"
              w={160}
            />
          </Stack>

          <Group justify="space-between">
            <Text size="sm">Transparent Background</Text>
            <Switch
              checked={widget.config.transparentBackground}
              onChange={(e) => onConfigChange({ transparentBackground: e.currentTarget.checked })}
            />
          </Group>
        </>
      )}
    </Stack>
  );
}
