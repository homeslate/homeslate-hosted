import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('reference Vite entry', () => {
  it('loads the Mantine styles every built-in widget needs', () => {
    const source = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/@mantine\/core\/styles\.css/);
    expect(source).toMatch(/@mantine\/dates\/styles\.css/);
  });

  it('depends on @mantine/dates, which the calendar widgets import', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies['@mantine/dates']).toEqual(expect.any(String));
  });
});
