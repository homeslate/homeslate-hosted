import { describe, expect, it } from 'vitest';
import { DEFAULT_GOOGLE_RUNTIME } from './googleRuntime';

describe('DEFAULT_GOOGLE_RUNTIME', () => {
  it('is signed out with the hosted /api kiosk prefix', () => {
    expect(DEFAULT_GOOGLE_RUNTIME.isAuthenticated).toBe(false);
    expect(DEFAULT_GOOGLE_RUNTIME.accessToken).toBeNull();
    expect(DEFAULT_GOOGLE_RUNTIME.displayId).toBeNull();
    expect(DEFAULT_GOOGLE_RUNTIME.kioskFetchBaseUrl).toBe('/api');
  });
});
