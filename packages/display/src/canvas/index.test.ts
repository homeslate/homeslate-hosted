import { describe, expect, it } from 'vitest';
import { DISPLAY_CANVAS_ENTRY, resolveDisplayThemeVars } from '@homeslate/display/canvas';

describe('@homeslate/display/canvas', () => {
  it('is importable by subpath', () => {
    expect(DISPLAY_CANVAS_ENTRY).toBe('@homeslate/display/canvas');
  });

  it('exports resolveDisplayThemeVars', () => {
    const vars = resolveDisplayThemeVars([], null, 'dark');
    expect(vars['--token-surface-canvas']).toEqual(expect.any(String));
  });
});
