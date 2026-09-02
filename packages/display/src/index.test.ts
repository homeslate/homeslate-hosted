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

  it('re-exports HolidayId from schema instead of duplicating the union', () => {
    const source = readFileSync(new URL('./holidays.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/from '@homeslate\/schema'/);
    expect(source).toMatch(/export type \{ HolidayId \}/);
    expect(source).not.toMatch(/export type HolidayId =/);
  });

  it('exports AlarmRuntime as a named function', () => {
    const source = readFileSync(new URL('./alarms/AlarmRuntime.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/export function AlarmRuntime\(/);
    expect(source).not.toMatch(/AlertRuntime/);
  });
});
