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

export type PickerStatus =
  | 'idle'      // no photos stored
  | 'pending'   // picker session open, waiting for user to pick
  | 'uploading' // fetching picked items and uploading to Blobs
  | 'ready'     // displaying stored photos
  | 'error';

export interface CurrentPhoto {
  objectUrl: string; // blob URL — revoked when next photo loads
  filename: string;
  createTime?: string;
}

interface UseGooglePhotosOptions {
  refreshInterval?: number;       // ms between auto photo changes
  savedImages?: StoredImage[];    // pre-stored images from widget config
}

interface UseGooglePhotosResult {
  isAuthenticated: boolean;
  pickerStatus: PickerStatus;
  uploadProgress: { done: number; total: number } | null;
  error: string | null;
  pickerUri: string | null;
  storedImages: StoredImage[];
  currentPhoto: CurrentPhoto | null;
  startPicker: () => Promise<void>;
  nextPhoto: () => void;
  clearSelection: () => void;
}

const DEFAULT_POLL_INTERVAL_MS = 5000;

export function useGooglePhotos({
  refreshInterval = 5 * 60 * 1000,
  savedImages = [],
}: UseGooglePhotosOptions = {}): UseGooglePhotosResult {
  const { accessToken, isAuthenticated } = useAuth();

  const [pickerStatus, setPickerStatus] = useState<PickerStatus>(
    savedImages.length > 0 ? 'ready' : 'idle'
  );
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [storedImages, setStoredImages] = useState<StoredImage[]>(savedImages);
  const [currentPhoto, setCurrentPhoto] = useState<CurrentPhoto | null>(null);

  const sessionRef = useRef<PickerSession | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  // ── Blob URL helpers ─────────────────────────────────────────────────────

  const revokeCurrent = useCallback(() => {
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
  }, []);

  const loadPhoto = useCallback(async (image: StoredImage) => {
    revokeCurrent();
    const objectUrl = await loadStoredImage(image.key);
    currentBlobUrlRef.current = objectUrl;
    setCurrentPhoto({ objectUrl, filename: image.filename, createTime: image.createTime });
  }, [revokeCurrent]);

  const loadRandomPhoto = useCallback(async (images: StoredImage[]) => {
    if (images.length === 0) return;
    const item = images[Math.floor(Math.random() * images.length)];
    await loadPhoto(item);
  }, [loadPhoto]);

  // ── Polling helpers ──────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  /**
   * After the user picks photos, upload them all to Netlify Blobs and return
   * StoredImage references. Shows progress as images are uploaded.
   */
  const uploadPickedItems = useCallback(
    async (items: PickedMediaItem[], token: string): Promise<StoredImage[]> => {
      const images = imageItems(items);
      const results: StoredImage[] = [];
      setUploadProgress({ done: 0, total: images.length });

      for (const item of images) {
        const key = await storeImage(item.mediaFile.baseUrl, token, 'w1920-h1080');
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
        await loadRandomPhoto(stored);
        setPickerStatus('ready');
        setPickerUri(null);
        // Delete the session now that we've permanently stored the images
        void deletePickerSession(token, session.id);
        sessionRef.current = null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve photos');
        setPickerStatus('error');
      }
    },
    [uploadPickedItems, loadRandomPhoto]
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

  const nextPhoto = useCallback(() => {
    if (storedImages.length === 0) return;
    void loadRandomPhoto(storedImages);
  }, [storedImages, loadRandomPhoto]);

  const clearSelection = useCallback(() => {
    stopPolling();
    revokeCurrent();
    if (sessionRef.current && accessToken) {
      void deletePickerSession(accessToken, sessionRef.current.id);
      sessionRef.current = null;
    }
    setStoredImages([]);
    setCurrentPhoto(null);
    setPickerUri(null);
    setPickerStatus('idle');
    setUploadProgress(null);
    setError(null);
  }, [accessToken, stopPolling, revokeCurrent]);

  // ── Load saved images on mount ────────────────────────────────────────────

  useEffect(() => {
    if (savedImages.length > 0 && !currentPhoto) {
      void loadRandomPhoto(savedImages).catch(() => {
        setError('Failed to load stored photos');
        setPickerStatus('error');
      });
    }
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-rotate photos ────────────────────────────────────────────────────

  useEffect(() => {
    if (photoTimerRef.current) clearInterval(photoTimerRef.current);
    if (pickerStatus === 'ready' && storedImages.length > 1) {
      photoTimerRef.current = setInterval(() => {
        void loadRandomPhoto(storedImages);
      }, refreshInterval);
    }
    return () => {
      if (photoTimerRef.current) clearInterval(photoTimerRef.current);
    };
  }, [pickerStatus, storedImages, refreshInterval, loadRandomPhoto]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopPolling();
      revokeCurrent();
      if (photoTimerRef.current) clearInterval(photoTimerRef.current);
    };
  }, [stopPolling, revokeCurrent]);

  // ── Reset when user signs out ──────────────────────────────────────────────
  // Note: stored images are still served from Blobs without auth, so we only
  // reset the picker state, not the displayed photo.
  useEffect(() => {
    if (!isAuthenticated) {
      stopPolling();
      setPickerUri(null);
      if (sessionRef.current) {
        sessionRef.current = null;
      }
    }
  }, [isAuthenticated, stopPolling]);

  return {
    isAuthenticated,
    pickerStatus,
    uploadProgress,
    error,
    pickerUri,
    storedImages,
    currentPhoto,
    startPicker,
    nextPhoto,
    clearSelection,
  };
}
