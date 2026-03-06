import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createPickerSession,
  getPickerSession,
  listPickedMediaItems,
  deletePickerSession,
  storeImage,
  loadStoredImage,
  imageItems,
  type PickerSession,
  type PickedMediaItem,
  type StoredImage,
} from '../services/googlePhotos';

export type CollagePickerStatus =
  | 'idle'      // no photos stored
  | 'pending'   // picker session open, waiting for user
  | 'uploading' // fetching picked items and uploading to Blobs
  | 'ready'     // displaying stored photos
  | 'error';

export interface CollagePhoto {
  objectUrl: string;
  filename: string;
  createTime?: string;
  /** index into storedImages this slot is showing */
  itemIndex: number;
}

interface UseGooglePhotoCollageOptions {
  /** number of concurrent photo slots to show */
  slotCount: number;
  /** ms between individual photo rotations */
  rotationInterval?: number;
  savedImages?: StoredImage[];
}

interface UseGooglePhotoCollageResult {
  isAuthenticated: boolean;
  pickerStatus: CollagePickerStatus;
  uploadProgress: { done: number; total: number } | null;
  error: string | null;
  pickerUri: string | null;
  storedImages: StoredImage[];
  /** one entry per visible slot; null while initially loading */
  slots: (CollagePhoto | null)[];
  /** which slot index is currently transitioning out */
  transitioningSlot: number | null;
  startPicker: () => Promise<void>;
  clearSelection: () => void;
}

// How many images to keep pre-loaded beyond the visible slots.
const PREFETCH_AHEAD = 3;
const DEFAULT_POLL_INTERVAL_MS = 5000;

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
  savedImages = [],
}: UseGooglePhotoCollageOptions): UseGooglePhotoCollageResult {
  const { accessToken, isAuthenticated } = useAuth();

  const [pickerStatus, setPickerStatus] = useState<CollagePickerStatus>(
    savedImages.length > 0 ? 'ready' : 'idle'
  );
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [storedImages, setStoredImages] = useState<StoredImage[]>(savedImages);
  const [slots, setSlots] = useState<(CollagePhoto | null)[]>(
    Array(slotCount).fill(null)
  );
  const [transitioningSlot, setTransitioningSlot] = useState<number | null>(null);

  const sessionRef = useRef<PickerSession | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fetch cache: Maps item index → blob URL
  const prefetchCacheRef = useRef<Map<number, string>>(new Map());
  const prefetchingRef = useRef<Set<number>>(new Set());

  // Per-slot blob URLs (for revocation when a slot is replaced).
  const blobUrlsRef = useRef<(string | null)[]>(Array(slotCount).fill(null));
  // Which item index each slot is currently showing.
  const slotItemIndexRef = useRef<(number | null)[]>(Array(slotCount).fill(null));
  // Last slotCount we filled (for re-filling when widget resizes and adds slots).
  const lastFilledSlotCountRef = useRef<number | null>(null);

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

  const prefetchNext = useCallback(
    (images: StoredImage[], count: number) => {
      if (images.length === 0) return;

      const occupied = new Set<number>([
        ...slotItemIndexRef.current.filter((i): i is number => i !== null),
        ...prefetchCacheRef.current.keys(),
        ...prefetchingRef.current,
      ]);

      let fetched = 0;
      const shuffled = [...Array(images.length).keys()].sort(() => Math.random() - 0.5);

      for (const idx of shuffled) {
        if (fetched >= count) break;
        if (occupied.has(idx)) continue;

        prefetchingRef.current.add(idx);
        fetched++;

        void loadStoredImage(images[idx].key)
          .then((url) => {
            prefetchingRef.current.delete(idx);
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
    async (slotIdx: number, images: StoredImage[]) => {
      if (images.length === 0) return;

      const currentIdx = slotItemIndexRef.current[slotIdx];
      const inUse = new Set<number>(
        slotItemIndexRef.current.filter((i): i is number => i !== null)
      );

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
        const exclude = new Set(inUse);
        if (currentIdx !== null) exclude.add(currentIdx);
        chosenIdx = pickRandomIndex(images.length, exclude) ?? 0;
        objectUrl = await loadStoredImage(images[chosenIdx].key);
      }

      revokeBlobAtSlot(slotIdx);
      blobUrlsRef.current[slotIdx] = objectUrl;
      slotItemIndexRef.current[slotIdx] = chosenIdx;

      const item = images[chosenIdx];
      setSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = {
          objectUrl: objectUrl!,
          filename: item.filename,
          createTime: item.createTime,
          itemIndex: chosenIdx!,
        };
        return next;
      });

      prefetchNext(images, 1);
    },
    [revokeBlobAtSlot, prefetchNext]
  );

  // ── Fill all slots in parallel ────────────────────────────────────────────

  const fillAllSlots = useCallback(
    async (images: StoredImage[], count: number) => {
      if (images.length === 0) return;
      await Promise.all(
        Array.from({ length: count }, (_, i) => loadItemIntoSlot(i, images))
      );
      prefetchNext(images, PREFETCH_AHEAD);
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

  /**
   * After the user picks photos, upload them all to Netlify Blobs and return
   * StoredImage references.
   */
  const uploadPickedItems = useCallback(
    async (items: PickedMediaItem[], token: string): Promise<StoredImage[]> => {
      const images = imageItems(items);
      const results: StoredImage[] = [];
      setUploadProgress({ done: 0, total: images.length });

      for (const item of images) {
        const key = await storeImage(item.mediaFile.baseUrl, token, 'w800-h600');
        results.push({ key, filename: item.mediaFile.filename, createTime: item.createTime });
        setUploadProgress((prev) => prev ? { ...prev, done: prev.done + 1 } : null);
      }

      setUploadProgress(null);
      return results;
    },
    []
  );

  const fetchItemsAndFinish = useCallback(
    async (session: PickerSession, token: string) => {
      setPickerStatus('uploading');
      try {
        const items = await listPickedMediaItems(token, session.id);
        const stored = await uploadPickedItems(items, token);
        setStoredImages(stored);
        await fillAllSlots(stored, slotCount);
        setPickerStatus('ready');
        setPickerUri(null);
        void deletePickerSession(token, session.id);
        sessionRef.current = null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve photos');
        setPickerStatus('error');
      }
    },
    [uploadPickedItems, fillAllSlots, slotCount]
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
    lastFilledSlotCountRef.current = null;
    slotItemIndexRef.current = Array(slotCount).fill(null);
    setStoredImages([]);
    setSlots(Array(slotCount).fill(null));
    setTransitioningSlot(null);
    setPickerUri(null);
    setPickerStatus('idle');
    setUploadProgress(null);
    setError(null);
  }, [accessToken, stopPolling, revokeAllBlobs, evictCache, slotCount]);

  // ── Load saved images when we have images and null slots ────────────────────
  // Runs on mount and when slotCount increases (e.g. after ResizeObserver updates
  // dimensions). The initial dimensions are 400×300 → 2 slots, but the widget
  // often resizes to show many more. Without this, newly added slots stay blank.
  useEffect(() => {
    const images = storedImages.length > 0 ? storedImages : savedImages;
    if (images.length === 0 || pickerStatus !== 'ready') return;
    if (lastFilledSlotCountRef.current === slotCount) return;
    lastFilledSlotCountRef.current = slotCount;
    void fillAllSlots(images, slotCount).catch(() => {
      setError('Failed to load stored photos');
      setPickerStatus('error');
    });
  }, [savedImages, storedImages, pickerStatus, slotCount, fillAllSlots]);

  // ── Auto-rotation ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);

    if (pickerStatus === 'ready' && storedImages.length > 1) {
      rotationTimerRef.current = setInterval(() => {
        const slotIdx = Math.floor(Math.random() * slotCount);
        setTransitioningSlot(slotIdx);

        setTimeout(() => {
          void loadItemIntoSlot(slotIdx, storedImages).then(() => {
            setTransitioningSlot(null);
          });
        }, 400);
      }, rotationInterval);
    }

    return () => {
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    };
  }, [pickerStatus, storedImages, rotationInterval, slotCount, loadItemIntoSlot]);

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

  // ── Reset picker state on sign-out (images still load from Blobs) ─────────

  useEffect(() => {
    if (!isAuthenticated) {
      stopPolling();
      setPickerUri(null);
      if (sessionRef.current) sessionRef.current = null;
    }
  }, [isAuthenticated, stopPolling]);

  return {
    isAuthenticated,
    pickerStatus,
    uploadProgress,
    error,
    pickerUri,
    storedImages,
    slots,
    transitioningSlot,
    startPicker,
    clearSelection,
  };
}
