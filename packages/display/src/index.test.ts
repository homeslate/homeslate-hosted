import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DISPLAY_PACKAGE_NAME, Display } from '@homeslate/display';

describe('@homeslate/display', () => {
  it('is importable by package name', () => {
    expect(DISPLAY_PACKAGE_NAME).toBe('@homeslate/display');
  });

  it('exports Display', () => {
    expect(typeof Display).toBe('function');
  });

  it('Display source does not import hosted persistence or auth', () => {
    const source = readFileSync(new URL('./Display.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/AuthContext/);
    expect(source).not.toMatch(/apiClient/);
    expect(source).not.toMatch(/dashboardStore/);
    expect(source).not.toMatch(/passcode/);
    expect(source).not.toMatch(/PinInput/);
  });
});
