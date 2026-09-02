import { describe, expect, it } from 'vitest';
import { EDITOR_PACKAGE_NAME } from '@homeslate/editor';

describe('@homeslate/editor', () => {
  it('is importable by package name', () => {
    expect(EDITOR_PACKAGE_NAME).toBe('@homeslate/editor');
  });
});
