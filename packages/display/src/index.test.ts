import { describe, expect, it } from 'vitest';
import { DISPLAY_PACKAGE_NAME } from '@homeslate/display';

describe('@homeslate/display', () => {
  it('is importable by package name', () => {
    expect(DISPLAY_PACKAGE_NAME).toBe('@homeslate/display');
  });
});
