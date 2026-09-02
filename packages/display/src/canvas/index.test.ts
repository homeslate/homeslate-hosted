import { readFileSync } from 'node:fs';
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

  it('DocumentCanvas source does not import hosted store or auth', () => {
    const source = readFileSync(new URL('./DocumentCanvas.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/dashboardStore/);
    expect(source).not.toMatch(/AuthContext/);
    expect(source).not.toMatch(/apiClient/);
  });

  it('WidgetWrapper source does not import dashboardStore', () => {
    const source = readFileSync(new URL('./WidgetWrapper.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/dashboardStore/);
  });

  it('BackgroundSlideshow reads View.background, not legacy layout fields', () => {
    const source = readFileSync(new URL('./BackgroundSlideshow.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/view\.background/);
    expect(source).not.toMatch(/backgroundImageSize|backgroundPhotos|backgroundOverlayOpacity|backgroundInterval/);
  });
});
