/** How long a cached display-calendar response is served without hitting the network. */
export const DISPLAY_CALENDAR_CLIENT_TTL_MS = 15 * 60 * 1000;

const DB_NAME = 'homeslate-display-calendar-v1';
const STORE_NAME = 'responses';
const DB_VERSION = 1;

export interface DisplayCalendarCacheEntry {
  url: string;
  body: string;
  status: number;
  fetchedAt: number;
}

function isDisplayCalendarRequest(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return parsed.pathname.includes('display-calendar');
  } catch {
    return url.includes('display-calendar');
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readEntry(url: string): Promise<DisplayCalendarCacheEntry | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
      req.onsuccess = () => resolve((req.result as DisplayCalendarCacheEntry | undefined) ?? null);
    });
  } finally {
    db.close();
  }
}

async function writeEntry(entry: DisplayCalendarCacheEntry): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    });
  } finally {
    db.close();
  }
}

export function isDisplayCalendarCacheFresh(fetchedAt: number, nowMs = Date.now()): boolean {
  return nowMs - fetchedAt < DISPLAY_CALENDAR_CLIENT_TTL_MS;
}

function jsonResponse(body: string, status: number, fromCache: boolean): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(fromCache ? { 'X-Homeslate-Calendar-Cache': 'hit' } : {}),
    },
  });
}

async function fetchAndStore(url: string, fetchImpl: typeof fetch): Promise<Response> {
  const res = await fetchImpl(url);
  const body = await res.text();
  if (res.ok) {
    await writeEntry({
      url,
      body,
      status: res.status,
      fetchedAt: Date.now(),
    });
  }
  return jsonResponse(body, res.status, false);
}

function scheduleRevalidate(url: string, fetchImpl: typeof fetch) {
  void fetchAndStore(url, fetchImpl).catch((err) => {
    console.warn('[display-calendar-cache] background revalidate failed', err);
  });
}

/** Stale-while-revalidate: fresh entries skip the network; stale/offline falls back to IndexedDB. */
export async function fetchDisplayCalendarCached(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fetchImpl: typeof fetch
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!isDisplayCalendarRequest(url)) {
    return fetchImpl(input, init);
  }

  const cached = await readEntry(url);

  if (cached && isDisplayCalendarCacheFresh(cached.fetchedAt)) {
    return jsonResponse(cached.body, cached.status, true);
  }

  if (cached) {
    scheduleRevalidate(url, fetchImpl);
    return jsonResponse(cached.body, cached.status, true);
  }

  try {
    return await fetchAndStore(url, fetchImpl);
  } catch (err) {
    const fallback = await readEntry(url);
    if (fallback) {
      console.warn('[display-calendar-cache] network failed; using stale cache', err);
      return jsonResponse(fallback.body, fallback.status, true);
    }
    throw err;
  }
}
