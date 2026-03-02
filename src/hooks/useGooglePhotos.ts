import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createPickerSession,
  getPickerSession,
  listPickedMediaItems,
  deletePickerSession,
  fetchAuthedImageUrl,
  imageItems,
  pickRandomItem,
  type PickerSession,
  type PickedMediaItem,
} from '../services/googlePhotos';

export type PickerStatus =
  | 'idle'      // no active session, no photos
  | 'pending'   // session created, waiting for user to pick
  | 'loading'   // mediaItemsSet=true, fetching items / loading image
  | 'ready'     // displaying a photo
  | 'error';

export interface GooglePhoto {
  objectUrl: string; // blob URL — authenticated, safe for img/background-image
  filename: string;
  createTime?: string;
}

interface UseGooglePhotosOptions {
  refreshInterval?: number;       // ms between auto photo changes
  savedMediaItems?: PickedMediaItem[];
}

interface UseGooglePhotosResult {
  isAuthenticated: boolean;
  pickerStatus: PickerStatus;
  error: string | null;
  pickerUri: string | null;
  mediaItems: PickedMediaItem[];
  currentPhoto: GooglePhoto | null;
  startPicker: () => Promise<void>;
  nextPhoto: () => void;
  clearSelection: () => void;
}

const DEFAULT_POLL_INTERVAL_MS = 5000;

export function useGooglePhotos({
  refreshInterval = 5 * 60 * 1000,
  savedMediaItems = [],
}: UseGooglePhotosOptions = {}): UseGooglePhotosResult {
  const { accessToken, isAuthenticated } = useAuth();

  const [pickerStatus, setPickerStatus] = useState<PickerStatus>(
    savedMediaItems.length > 0 ? 'loading' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<PickedMediaItem[]>(savedMediaItems);
  const [currentPhoto, setCurrentPhoto] = useState<GooglePhoto | null>(null);

  const sessionRef = useRef<PickerSession | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track the current blob URL so we can revoke it when it changes
  const currentBlobUrlRef = useRef<string | null>(null);

  // ── Blob URL helpers ─────────────────────────────────────────────────────

  const revokeCurrent = useCallback(() => {
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
  }, []);

  const loadPhoto = useCallback(
    async (item: PickedMediaItem, token: string) => {
      revokeCurrent();
      const objectUrl = await fetchAuthedImageUrl(item.mediaFile.baseUrl, token);
      currentBlobUrlRef.current = objectUrl;
      setCurrentPhoto({
        objectUrl,
        filename: item.mediaFile.filename,
        createTime: item.createTime,
      });
    },
    [revokeCurrent]
  );

  const loadRandomPhoto = useCallback(
    async (items: PickedMediaItem[], token: string) => {
      const item = pickRandomItem(items);
      if (!item) return;
      await loadPhoto(item, token);
    },
    [loadPhoto]
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
        await loadRandomPhoto(items, token);
        setPickerStatus('ready');
        setPickerUri(null);
        void deletePickerSession(token, session.id);
        sessionRef.current = null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to retrieve photos');
        setPickerStatus('error');
      }
    },
    [loadRandomPhoto]
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
    if (!accessToken || mediaItems.length === 0) return;
    void loadRandomPhoto(mediaItems, accessToken);
  }, [accessToken, mediaItems, loadRandomPhoto]);

  const clearSelection = useCallback(() => {
    stopPolling();
    revokeCurrent();
    if (sessionRef.current && accessToken) {
      void deletePickerSession(accessToken, sessionRef.current.id);
      sessionRef.current = null;
    }
    setMediaItems([]);
    setCurrentPhoto(null);
    setPickerUri(null);
    setPickerStatus('idle');
    setError(null);
  }, [accessToken, stopPolling, revokeCurrent]);

  // ── Load saved media items on mount ───────────────────────────────────────

  useEffect(() => {
    if (savedMediaItems.length > 0 && accessToken && !currentPhoto) {
      void loadRandomPhoto(savedMediaItems, accessToken).then(() => {
        setPickerStatus('ready');
      });
    }
  // Only run on mount / when accessToken first becomes available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── Auto-rotate photos ────────────────────────────────────────────────────

  useEffect(() => {
    if (photoTimerRef.current) clearInterval(photoTimerRef.current);
    if (pickerStatus === 'ready' && imageItems(mediaItems).length > 1 && accessToken) {
      photoTimerRef.current = setInterval(() => {
        void loadRandomPhoto(mediaItems, accessToken);
      }, refreshInterval);
    }
    return () => {
      if (photoTimerRef.current) clearInterval(photoTimerRef.current);
    };
  }, [pickerStatus, mediaItems, refreshInterval, accessToken, loadRandomPhoto]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopPolling();
      revokeCurrent();
      if (photoTimerRef.current) clearInterval(photoTimerRef.current);
    };
  }, [stopPolling, revokeCurrent]);

  // ── Reset when user signs out ──────────────────────────────────────────────

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
    currentPhoto,
    startPicker,
    nextPhoto,
    clearSelection,
  };
}
