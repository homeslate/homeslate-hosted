import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HOST_IMPORT_RE = /AuthContext|apiClient|dashboardStore|from ['"]@?neon|from ['"]drizzle-orm|from ['"][^'"]*netlify/;

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkSourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

describe('@homeslate/editor host imports', () => {
  it('matches neon and drizzle import specifiers, not canvas ids', () => {
    expect("import { neon } from '@neondatabase/serverless'").toMatch(HOST_IMPORT_RE);
    expect("import { neon } from 'drizzle-orm/neon-http'").toMatch(HOST_IMPORT_RE);
    expect("import { schedule } from '@netlify/functions'").toMatch(HOST_IMPORT_RE);
    expect('id: "neon"').not.toMatch(HOST_IMPORT_RE);
    expect("const neon = 'ok'").not.toMatch(HOST_IMPORT_RE);
  });

  it('does not import hosted auth, api, store, neon, or netlify', () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const files = walkSourceFiles(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(HOST_IMPORT_RE);
    }
  });
});
