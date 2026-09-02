import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WIDGETS_PACKAGE_NAME } from '@homeslate/widgets';
import { DISPLAY_OWNER_SIGN_IN_MESSAGE } from '@homeslate/widgets/server';

describe('@homeslate/widgets', () => {
  it('is importable by package name', () => {
    expect(WIDGETS_PACKAGE_NAME).toBe('@homeslate/widgets');
  });

  it('exposes the React-free server constants on an explicit subpath', () => {
    expect(DISPLAY_OWNER_SIGN_IN_MESSAGE).toEqual(expect.any(String));
  });

  it('resolves the barrel the same way for every condition', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { exports: Record<string, unknown> };

    expect(manifest.exports['.']).toBe('./src/index.ts');
    expect(manifest.exports['./server']).toBe('./src/server.ts');
    expect(manifest.exports['./schemas']).toBe('./src/schemas.ts');
  });
});
