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

/**
 * Fetches an authenticated image URL and returns a blob object URL safe for use
 * in <img> src or CSS background-image. The caller is responsible for calling
 * URL.revokeObjectURL() when the URL is no longer needed.
 */
export async function fetchAuthedImageUrl(baseUrl: string, token: string): Promise<string> {
  const response = await fetch(`${baseUrl}=w1920-h1080`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function imageItems(items: PickedMediaItem[]): PickedMediaItem[] {
  return items.filter(isImageItem);
}

export function pickRandomItem(items: PickedMediaItem[]): PickedMediaItem | null {
  const images = imageItems(items);
  if (images.length === 0) return null;
  return images[Math.floor(Math.random() * images.length)];
}
