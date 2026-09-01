import { describe, expect, it } from 'vitest';
import { GOOGLE_PACKAGE_NAME } from '@homeslate/google';

describe('@homeslate/google', () => {
  it('is importable by package name', () => {
    expect(GOOGLE_PACKAGE_NAME).toBe('@homeslate/google');
  });
});
