import { describe, expect, it } from 'vitest';
import { DISPLAY_CANVAS_ENTRY } from '@homeslate/display/canvas';

describe('@homeslate/display/canvas', () => {
  it('is importable by subpath', () => {
    expect(DISPLAY_CANVAS_ENTRY).toBe('@homeslate/display/canvas');
  });
});
