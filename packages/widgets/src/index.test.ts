import { describe, expect, it } from 'vitest';
import { WIDGETS_PACKAGE_NAME } from '@homeslate/widgets';

describe('@homeslate/widgets', () => {
  it('is importable by package name', () => {
    expect(WIDGETS_PACKAGE_NAME).toBe('@homeslate/widgets');
  });
});
