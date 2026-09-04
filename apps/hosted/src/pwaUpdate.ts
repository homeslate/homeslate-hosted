import { registerSW as defaultRegisterSW } from 'virtual:pwa-register';

type UpdateSW = (reloadPage?: boolean) => Promise<void>;
type RegisterSW = (options?: {
  immediate?: boolean;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}) => UpdateSW;

export interface RegisterPwaUpdatesOptions {
  registerSW?: RegisterSW;
  checkIntervalMs?: number;
}

const DEFAULT_CHECK_INTERVAL_MS = 30 * 60 * 1000;

let displaySession = false;
let pendingUpdate = false;
let updateSW: UpdateSW | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function notifyPending(): void {
  for (const listener of listeners) listener();
}

export function setDisplaySession(active: boolean): void {
  const wasActive = displaySession;
  displaySession = active;
  if (active && !wasActive && pendingUpdate) notifyPending();
}

export function subscribeToPendingUpdate(listener: () => void): () => void {
  listeners.add(listener);
  if (pendingUpdate && displaySession) listener();
  return () => {
    listeners.delete(listener);
  };
}

export function applyUpdate(reload: boolean): void {
  pendingUpdate = false;
  void updateSW?.(reload);
}

function handleNeedRefresh(): void {
  pendingUpdate = true;
  if (displaySession) {
    notifyPending();
    return;
  }
  applyUpdate(false);
}

export function registerPwaUpdates(options: RegisterPwaUpdatesOptions = {}): void {
  if (updateSW) return;

  const register = options.registerSW ?? defaultRegisterSW;
  const checkIntervalMs = options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;

  updateSW = register({
    immediate: true,
    onNeedRefresh: handleNeedRefresh,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      pollTimer = setInterval(async () => {
        if (registration.installing || !navigator) return;
        if ('connection' in navigator && !navigator.onLine) return;
        try {
          const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: { cache: 'no-store', 'cache-control': 'no-cache' },
          });
          if (resp?.status === 200) await registration.update();
        } catch {
          // Ignore fetch errors (offline, server down)
        }
      }, checkIntervalMs);
    },
  });
}

/** Clears module state between Vitest cases. */
export function resetPwaUpdateForTests(): void {
  displaySession = false;
  pendingUpdate = false;
  updateSW = null;
  listeners.clear();
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
