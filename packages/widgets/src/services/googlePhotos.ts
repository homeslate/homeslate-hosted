// Google Photos Picker API Service
// Uses the Picker API (photospicker.googleapis.com) introduced in 2025 after
// the photoslibrary.readonly scope was removed on March 31 2025.

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet: boolean;
  pollingConfig?: {
    pollInterval?: string; // duration string e.g. "5s"
    timeoutIn?: string;
  };
}

export interface PickedMediaItem {
  id: string;
  createTime: string;
  type: 'PHOTO' | 'VIDEO';
  mediaFile: {
    baseUrl: string;
    mimeType: string;
    filename: string;
    mediaFileMetadata?: {
      width?: number;
      height?: number;
      photo?: Record<string, unknown>;
      video?: Record<string, unknown>;
    };
  };
}

export interface GooglePhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  filename: string;
  createTime?: string;
  width?: number;
  height?: number;
}

/**
 * A stored image reference — the blob key returned by /api/photo-store.
 * Once stored, images are served from Netlify Blobs indefinitely with no
 * dependency on Google Photos baseUrls (which expire after 60 minutes).
 */
export interface StoredImage {
  /** Netlify Blobs key, derived from SHA-256(baseUrl|size). */
  key: string;
  filename: string;
  createTime?: string;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createPickerSession(token: string): Promise<PickerSession> {
  const response = await fetch(`${PICKER_API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Token expired. Please sign in again.');
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to create picker session: ${response.status} ${body}`);
  }

  return response.json() as Promise<PickerSession>;
}

export async function getPickerSession(token: string, sessionId: string): Promise<PickerSession> {
  const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Token expired. Please sign in again.');
    throw new Error(`Failed to get picker session: ${response.statusText}`);
  }

  return response.json() as Promise<PickerSession>;
}

export async function deletePickerSession(token: string, sessionId: string): Promise<void> {
  await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// ─── Media items ──────────────────────────────────────────────────────────────

export async function listPickedMediaItems(
  token: string,
  sessionId: string
): Promise<PickedMediaItem[]> {
  const items: PickedMediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${PICKER_API_BASE}/mediaItems`);
    url.searchParams.set('sessionId', sessionId);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Token expired. Please sign in again.');
      throw new Error(`Failed to list picked media items: ${response.statusText}`);
    }

    const data = await response.json() as { mediaItems?: PickedMediaItem[]; nextPageToken?: string };
    items.push(...(data.mediaItems ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isImageItem(item: PickedMediaItem): boolean {
  return item.mediaFile.mimeType.startsWith('image/');
}

export function imageItems(items: PickedMediaItem[]): PickedMediaItem[] {
  return items.filter(isImageItem);
}

export function pickRandomItem(items: PickedMediaItem[]): PickedMediaItem | null {
  const images = imageItems(items);
  if (images.length === 0) return null;
  return images[Math.floor(Math.random() * images.length)];
}

// ─── Blob storage ─────────────────────────────────────────────────────────────

/**
 * Upload a Google Photos image to Netlify Blobs via the authenticated
 * photo-store endpoint. Returns a blob key that never expires.
 *
 * If the image was already uploaded the server returns the existing key
 * immediately (the call is idempotent).
 */
export async function storeImage(
  baseUrl: string,
  token: string,
  size = 'w800-h600'
): Promise<string> {
  const response = await fetch('/api/photo-store', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ baseUrl, size }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to store image: ${response.status} ${text}`);
  }

  const data = await response.json() as { key: string };
  return data.key;
}

/**
 * Fetch a previously stored image from Netlify Blobs and return a blob
 * object URL safe for use in <img> src or CSS background-image.
 *
 * The caller is responsible for calling URL.revokeObjectURL() when done.
 * No authentication is required — the image is served publicly by key.
 */
export async function loadStoredImage(key: string): Promise<string> {
  const url = `/api/photo-proxy?key=${encodeURIComponent(key)}`;
  const maxRetries = 5;
  let attempt = 0;
  let lastStatus = 0;

  while (attempt <= maxRetries) {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }

    lastStatus = response.status;

    // Newly written blobs can briefly return 404 before propagation finishes.
    if (response.status === 404 && attempt < maxRetries) {
      const backoffMs = 250 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      attempt++;
      continue;
    }

    throw new Error(`Failed to load image: ${response.status}`);
  }

  throw new Error(`Failed to load image: ${lastStatus || 404}`);
}
