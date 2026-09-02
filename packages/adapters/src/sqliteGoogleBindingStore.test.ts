import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openSqlite } from './sqlite';
import { SqliteGoogleBindingStore } from './sqliteGoogleBindingStore';

describe('SqliteGoogleBindingStore', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('set and get account id for a display', async () => {
    dir = await mkdtemp(join(tmpdir(), 'homeslate-bind-'));
    const bindings = new SqliteGoogleBindingStore({
      database: openSqlite(join(dir, 'ref.sqlite')),
    });
    expect(await bindings.getAccountIdForDisplay('d1')).toBeNull();
    await bindings.setAccountIdForDisplay('d1', 'local');
    expect(await bindings.getAccountIdForDisplay('d1')).toBe('local');
    await bindings.setAccountIdForDisplay('d1', 'other');
    expect(await bindings.getAccountIdForDisplay('d1')).toBe('other');
  });
});
