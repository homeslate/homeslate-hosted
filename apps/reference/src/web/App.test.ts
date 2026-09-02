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
});
