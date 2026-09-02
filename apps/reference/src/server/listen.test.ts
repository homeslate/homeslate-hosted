import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('reference listen entry', () => {
  it('points Google OAuth publicBaseUrl at the Vite origin', () => {
    const source = readFileSync(new URL('./listen.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/publicBaseUrl:\s*'http:\/\/127\.0\.0\.1:5174'/);
  });
});
