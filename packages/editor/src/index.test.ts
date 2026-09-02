import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EDITOR_PACKAGE_NAME, Editor } from '@homeslate/editor';

describe('@homeslate/editor', () => {
  it('is importable by package name', () => {
    expect(EDITOR_PACKAGE_NAME).toBe('@homeslate/editor');
  });

  it('exports Editor', () => {
    expect(typeof Editor).toBe('function');
  });

  it('Editor source does not import hosted auth, api, or store', () => {
    const source = readFileSync(new URL('./Editor.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/AuthContext/);
    expect(source).not.toMatch(/apiClient/);
    expect(source).not.toMatch(/dashboardStore/);
    expect(source).not.toMatch(/react-router/);
  });

  it('WidgetPanel source does not import hosted auth, api, or store', () => {
    const source = readFileSync(new URL('./WidgetPanel.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/AuthContext/);
    expect(source).not.toMatch(/apiClient/);
    expect(source).not.toMatch(/dashboardStore/);
    expect(source).toMatch(/useGoogleRuntime/);
  });
});
