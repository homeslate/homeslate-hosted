import { describe, expect, it } from 'vitest';
import { SCHEMA_PACKAGE_NAME } from '@homeslate/schema';

describe('@homeslate/schema', () => {
  it('is importable by package name', () => {
    expect(SCHEMA_PACKAGE_NAME).toBe('@homeslate/schema');
  });
});
