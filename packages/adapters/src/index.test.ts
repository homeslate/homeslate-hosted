import { describe, expect, it } from 'vitest';
import { ADAPTERS_PACKAGE_NAME } from '@homeslate/adapters';

describe('@homeslate/adapters', () => {
  it('is importable by package name', () => {
    expect(ADAPTERS_PACKAGE_NAME).toBe('@homeslate/adapters');
  });
});
