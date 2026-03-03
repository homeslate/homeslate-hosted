import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createPickerSession,
  getPickerSession,
  listPickedMediaItems,
  deletePickerSession,
  fetchAuthedImageUrl,
  imageItems,
  type PickerSession,
  type PickedMediaItem,
} from '../services/googlePhotos';

export type CollagePickerStatus =
  | 'idle'      // no photos selected yet
  | 'pending'   // picker session open, waiting for user
  | 'loading'   // fetching items / loading initial images
  | 'ready'     // displaying photos
  | 'error';

export interface CollagePhoto {
  objectUrl: string;
  filename: string;
  createTime?: string;
  /** index into the imageItems array this slot is showing */
  itemIndex: number;
}

interface UseGooglePhotoCollageOptions {
  /** number of concurrent photo slots to show */
  slotCount: number;
  /** ms between individual photo rotations */
  rotationInterval?: number;
  savedMediaItems?: PickedMediaItem[];
}

interface UseGooglePhotoCollageResult {
  isAuthenticated: boolean;
  pickerStatus: CollagePickerStatus;
  error: string | null;
  pickerUri: string | null;
  mediaItems: PickedMediaItem[];
  /** one entry per visible slot; null while initially loading */
  slots: (CollagePhoto | null)[];
  /** which slot index is currently transitioning out */
  transitioningSlot: number | null;
  startPicker: () => Promise<void>;
  clearSelection: () => void;
}

// How many images to keep pre-fetched beyond the visible slots.
const PREFETCH_AHEAD = 3;
const DEFAULT_POLL_INTERVAL_MS = 5000;

function fetchThumbnail(baseUrl: string, token: string): Promise<string> {
  return fetchAuthedImageUrl(baseUrl, token, 'w800-h600');
}

function pickRandomIndex(count: number, exclude: Set<number>): number | null {
  const available: number[] = [];
  for (let i = 0; i < count; i++) {
    if (!exclude.has(i)) available.push(i);
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export function useGooglePhotoCollage({
  slotCount,
  rotationInterval = 10_000,
  savedMediaItems = [],
}: UseGooglePhotoCollageOptions): UseGooglePhotoCollageResult {
  const { accessToken, isAuthenticated } = useAuth();

  const [pickerStatus, setPickerStatus] = useState<CollagePickerStatus>(
    savedMediaItems.length > 0 ? 'loading' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<PickedMediaItem[]>(savedMediaItems);
  const [slots, setSlots] = useState<(CollagePhoto | null)[]>(
    Array(slotCount).fill(null)
  );
  const [transitioningSlot, setTransitioningSlot] = useState<number | null>(null);

  const sessionRef = useRef<PickerSession | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Pre-fetch cache ───────────────────────────────────────────────────────
  // Maps item index → blob URL for images that have been pre-fetched but are
  // not yet displayed. When a slot rotates we pull from here instantly, then
  // immediately kick off a background fetch for the next item to replace it.
  const prefetchCacheRef = useRef<Map<number, string>>(new Map());
  // Tracks in-flight fetches so we don't double-fetch the same item.
  const prefetchingRef = useRef<Set<number>>(new Set());

  // Per-slot blob URLs (for revocation when a slot is replaced).
  const blobUrlsRef = useRef<(string | null)[]>(Array(slotCount).fill(null));
  // Which item index each slot is currently showing.
  const slotItemIndexRef = useRef<(number | null)[]>(Array(slotCount).fill(null));

  // ── Cache helpers ─────────────────────────────────────────────────────────

  const evictCache = useCallback(() => {
    prefetchCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    prefetchCacheRef.current.clear();
    prefetchingRef.current.clear();
  }, []);

  const revokeBlobAtSlot = useCallback((slotIdx: number) => {
    const url = blobUrlsRef.current[slotIdx];
    if (url) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current[slotIdx] = null;
    }
  }, []);

  const revokeAllBlobs = useCallback(() => {
    blobUrlsRef.current.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    blobUrlsRef.current = Array(slotCount).fill(null);
  }, [slotCount]);

  // ── Pre-fetch logic ───────────────────────────────────────────────────────

  /**
   * Fetch `count` images that are not currently displayed and not already
   * cached, storing blob URLs in prefetchCacheRef. Runs entirely in the
   * background — never blocks the render path.
   */
  const prefetchNext = useCallback(
    (items: PickedMediaItem[], token: string, count: number) => {
      const images = imageItems(items);
      if (images.length === 0) return;

      // Indices currently shown on screen or already cached/fetching.
      const occupied = new Set<number>([
        ...slotItemIndexRef.current.filter((i): i is number => i !== null),
        ...prefetchCacheRef.current.keys(),
        ...prefetchingRef.current,
      ]);

      let fetched = 0;
      // Walk items in a random order to avoid always pre-fetching the same ones.
      const shuffled = [...Array(images.length).keys()].sort(() => Math.random() - 0.5);

      for (const idx of shuffled) {
        if (fetched >= count) break;
        if (occupied.has(idx)) continue;

        prefetchingRef.current.add(idx);
        fetched++;

        void fetchThumbnail(images[idx].mediaFile.baseUrl, token)
          .then((url) => {
            prefetchingRef.current.delete(idx);
            // Only store if not already evicted (e.g. clearSelection called).
            prefetchCacheRef.current.set(idx, url);
          })
          .catch(() => {
            prefetchingRef.current.delete(idx);
          });
      }
    },
    []
  );

  // ── Assign a slot from cache (instant) or fetch (fallback) ───────────────

  const loadItemIntoSlot = useCallback(
    async (slotIdx: number, items: PickedMediaItem[], token: string) => {
      const images = imageItems(items);
      if (images.length === 0) return;

      // Prefer an item that's already in the pre-fetch cache.
      const currentIdx = slotItemIndexRef.current[slotIdx];
      const inUse = new Set<number>(
        slotItemIndexRef.current.filter((i): i is number => i !== null)
      );

      // Try to pop a cached item that isn't already on screen.
      let chosenIdx: number | null = null;
      let objectUrl: string | null = null;

      for (const [idx, url] of prefetchCacheRef.current) {
        if (!inUse.has(idx) || idx === currentIdx) {
          chosenIdx = idx;
          objectUrl = url;
          prefetchCacheRef.current.delete(idx);
          break;
        }
      }

      if (chosenIdx === null || objectUrl === null) {
        // Cache miss — fall back to a live fetch.
        const exclude = new Set(inUse);
        if (currentIdx !== null) exclude.add(currentIdx);
        chosenIdx = pickRandomIndex(images.length, exclude) ?? 0;
        objectUrl = await fetchThumbnail(images[chosenIdx].mediaFile.baseUrl, token);
      }

      revokeBlobAtSlot(slotIdx);
      blobUrlsRef.current[slotIdx] = objectUrl;
      slotItemIndexRef.current[slotIdx] = chosenIdx;

      const item = images[chosenIdx];
      setSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = {
          objectUrl: objectUrl!,
          filename: item.mediaFile.filename,
          createTime: item.createTime,
          itemIndex: chosenIdx!,
        };
        return next;
      });

      // Immediately top up the cache to replace the slot we just consumed.
      prefetchNext(items, token, 1);
    },
    [revokeBlobAtSlot, prefetchNext]
  );

  // ── Fill all slots in parallel, then start pre-fetching ──────────────────

  const fillAllSlots = useCallback(
    async (items: PickedMediaItem[], token: string, count: number) => {
      const images = imageItems(items);
      if (images.length === 0) return;

      // Load all visible slots in parallel for fast initial render.
      await Promise.all(
        Array.from({ length: count }, (_, i) => loadItemIntoSlot(i, items, token))
      );

      // Pre-fetch the next batch in the background.
      prefetchNext(items, token, PREFETCH_AHEAD);
    },
    [loadItemIntoSlot, prefetchNext]
  );

  // ── Polling helpers ──────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const fetchItemsAndFinish = useCallback(
    async (session: PickerSession, token: string) => {
      setPickerStatus('loading');
      try {
        const items = await listPickedMediaItems(token, session.id);
        setMediaItems(items);
        await fillAllSlots(items, token, slotCount);
        setPickerStatus('ready');
        setPickerUri(null);
        void deletePickerSession(token, session.id);
        sessionRef.current = null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve photos');
        setPickerStatus('error');
      }
    },
    [fillAllSlots, slotCount]
  );

  const pollSession = useCallback(
    async (session: PickerSession, token: string) => {
      try {
        const updated = await getPickerSession(token, session.id);
        sessionRef.current = updated;

        if (updated.mediaItemsSet) {
          stopPolling();
          await fetchItemsAndFinish(updated, token);
          return;
        }

        const pollIntervalMs = updated.pollingConfig?.pollInterval
          ? parseFloat(updated.pollingConfig.pollInterval) * 1000
          : DEFAULT_POLL_INTERVAL_MS;

        pollTimerRef.current = setTimeout(() => {
          void pollSession(updated, token);
        }, pollIntervalMs);
      } catch (err) {
        stopPolling();
        setError(err instanceof Error ? err.message : 'Polling error');
        setPickerStatus('error');
      }
    },
    [stopPolling, fetchItemsAndFinish]
  );

  // ── Public actions ───────────────────────────────────────────────────────

  const startPicker = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    setPickerStatus('pending');

    try {
      const session = await createPickerSession(accessToken);
      sessionRef.current = session;
      setPickerUri(session.pickerUri);

      const pollIntervalMs = session.pollingConfig?.pollInterval
        ? parseFloat(session.pollingConfig.pollInterval) * 1000
        : DEFAULT_POLL_INTERVAL_MS;

      pollTimerRef.current = setTimeout(() => {
        void pollSession(session, accessToken);
      }, pollIntervalMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start photo picker');
      setPickerStatus('error');
    }
  }, [accessToken, pollSession]);

  const clearSelection = useCallback(() => {
    stopPolling();
    if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    revokeAllBlobs();
    evictCache();
    if (sessionRef.current && accessToken) {
      void deletePickerSession(accessToken, sessionRef.current.id);
      sessionRef.current = null;
    }
    slotItemIndexRef.current = Array(slotCount).fill(null);
    setMediaItems([]);
    setSlots(Array(slotCount).fill(null));
    setTransitioningSlot(null);
    setPickerUri(null);
    setPickerStatus('idle');
    setError(null);
  }, [accessToken, stopPolling, revokeAllBlobs, evictCache, slotCount]);

  // ── Load saved media items on mount ──────────────────────────────────────

  useEffect(() => {
    if (savedMediaItems.length > 0 && accessToken && slots.every((s) => s === null)) {
      void fillAllSlots(savedMediaItems, accessToken, slotCount).then(() => {
        setPickerStatus('ready');
      });
    }
    // Only run when accessToken becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── Auto-rotation: swap one random slot per tick from cache ───────────────

  useEffect(() => {
    if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);

    const items = imageItems(mediaItems);
    if (pickerStatus === 'ready' && items.length > 1 && accessToken) {
      rotationTimerRef.current = setInterval(() => {
        const slotIdx = Math.floor(Math.random() * slotCount);
        setTransitioningSlot(slotIdx);

        // After fade-out (400 ms), swap in the pre-fetched image instantly.
        setTimeout(() => {
          void loadItemIntoSlot(slotIdx, mediaItems, accessToken!).then(() => {
            setTransitioningSlot(null);
          });
        }, 400);
      }, rotationInterval);
    }

    return () => {
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    };
  }, [pickerStatus, mediaItems, rotationInterval, accessToken, slotCount, loadItemIntoSlot]);

  // ── Re-sync slot count if slotCount changes ───────────────────────────────

  useEffect(() => {
    setSlots((prev) => {
      if (prev.length === slotCount) return prev;
      const next = Array(slotCount).fill(null) as (CollagePhoto | null)[];
      for (let i = 0; i < Math.min(prev.length, slotCount); i++) {
        next[i] = prev[i];
      }
      return next;
    });
    while (blobUrlsRef.current.length < slotCount) blobUrlsRef.current.push(null);
    while (slotItemIndexRef.current.length < slotCount) slotItemIndexRef.current.push(null);
  }, [slotCount]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopPolling();
      revokeAllBlobs();
      evictCache();
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    };
  }, [stopPolling, revokeAllBlobs, evictCache]);

  // ── Reset when signed out ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) {
      clearSelection();
    }
  }, [isAuthenticated, clearSelection]);

  return {
    isAuthenticated,
    pickerStatus,
    error,
    pickerUri,
    mediaItems,
    slots,
    transitioningSlot,
    startPicker,
    clearSelection,
  };
}
