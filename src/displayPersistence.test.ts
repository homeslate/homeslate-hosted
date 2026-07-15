import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISPLAY_LOCAL_KEY,
  DISPLAY_SESSION_KEY,
  clearSessionDisplayId,
  persistDisplayId,
  resolveDisplayId,
} from './displayPersistence';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matches && (query.includes('standalone') || query.includes('fullscreen')),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  const session = createMemoryStorage();
  const local = createMemoryStorage();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: session,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: local,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  });
  mockMatchMedia(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('persistDisplayId', () => {
  it('writes the id to both sessionStorage and localStorage', () => {
    persistDisplayId('abc-123');

    expect(sessionStorage.getItem(DISPLAY_SESSION_KEY)).toBe('abc-123');
    expect(localStorage.getItem(DISPLAY_LOCAL_KEY)).toBe('abc-123');
  });
});

describe('resolveDisplayId', () => {
  it('prefers the URL query param over storage', () => {
    sessionStorage.setItem(DISPLAY_SESSION_KEY, 'from-session');
    localStorage.setItem(DISPLAY_LOCAL_KEY, 'from-local');

    expect(resolveDisplayId('?display=from-url')).toBe('from-url');
  });

  it('falls back to sessionStorage when URL has no display param', () => {
    sessionStorage.setItem(DISPLAY_SESSION_KEY, 'from-session');
    localStorage.setItem(DISPLAY_LOCAL_KEY, 'from-local');

    expect(resolveDisplayId('')).toBe('from-session');
  });

  it('restores from localStorage in standalone mode when URL and session are empty', () => {
    mockMatchMedia(true);
    localStorage.setItem(DISPLAY_LOCAL_KEY, 'tablet-display');

    expect(resolveDisplayId('')).toBe('tablet-display');
  });

  it('does not restore from localStorage in a normal browser tab', () => {
    mockMatchMedia(false);
    localStorage.setItem(DISPLAY_LOCAL_KEY, 'tablet-display');

    expect(resolveDisplayId('')).toBeNull();
  });
});

describe('clearSessionDisplayId', () => {
  it('clears sessionStorage but leaves localStorage intact', () => {
    persistDisplayId('keep-me');
    clearSessionDisplayId();

    expect(sessionStorage.getItem(DISPLAY_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(DISPLAY_LOCAL_KEY)).toBe('keep-me');
  });
});
