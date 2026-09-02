import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('reference web host', () => {
  it('mounts Editor and Display from packages and does not import hosted auth', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/from '@homeslate\/editor'/);
    expect(source).toMatch(/from '@homeslate\/display'/);
    expect(source).not.toMatch(/AuthContext/);
    expect(source).not.toMatch(/dashboardStore/);
    expect(source).not.toMatch(/apiClient/);
    expect(source).not.toMatch(/netlify/);
    expect(source).not.toMatch(/drizzle-orm/);
  });

  it('flushes the pending editor PUT on unmount', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/createDebouncedPersist/);
    expect(source).toMatch(/\.flush\(/);
  });

  it('uses keepalive only for unload flush, not in-session PUTs', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    const persist = readFileSync(new URL('./editorPersist.ts', import.meta.url), 'utf8');
    expect(app).not.toMatch(/keepalive:\s*true/);
    expect(app).toMatch(/keepalive/);
    expect(persist).toMatch(/pagehide/);
    expect(persist).toMatch(/keepalive:\s*true/);
    expect(persist).toMatch(/keepalive:\s*false/);
  });

  it('registers the unload flush listeners from an effect so StrictMode stays symmetric', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    const persist = readFileSync(new URL('./editorPersist.ts', import.meta.url), 'utf8');
    expect(persist.indexOf('addEventListener')).toBeGreaterThan(persist.indexOf('attach()'));
    expect(app).toMatch(/persist\.attach\(\)/);
  });

  it('routes every document PUT through a checked helper instead of a discarded fetch', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/void fetch\(/);
    expect(source).toMatch(/putJson\(`\/api\/displays\//);
    expect(source).toMatch(/putJson\(`\/api\/public\//);
    expect(source).toMatch(/if \(!response\.ok\)/);
  });

  it('surfaces editor and kiosk save failures instead of swallowing them', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source.match(/setSaveError\(errorMessage\(cause\)\)/g)).toHaveLength(2);
    expect(source.match(/Not saved: \{saveError\}/g)).toHaveLength(2);
  });

  it('renders server validation errors, not just the error field', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/body\.errors/);
  });
});

