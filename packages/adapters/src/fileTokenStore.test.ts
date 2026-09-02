import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileTokenStore } from './fileTokenStore';

describe('FileTokenStore', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function store() {
    dir = await mkdtemp(join(tmpdir(), 'homeslate-tokens-'));
    return new FileTokenStore({ dir });
  }

  it('put, get, getRefreshToken, delete round-trip', async () => {
    const tokens = await store();
    expect(await tokens.getTokens('local')).toBeNull();
    await tokens.putTokens('local', {
      refreshToken: 'r1',
      accessToken: 'a1',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    expect(await tokens.getRefreshToken('local')).toBe('r1');
    expect(await tokens.getTokens('local')).toMatchObject({ refreshToken: 'r1', accessToken: 'a1' });
    await tokens.deleteTokens('local');
    expect(await tokens.getTokens('local')).toBeNull();
  });

  it('rejects account ids that would escape the token directory', async () => {
    const tokens = await store();
    await expect(tokens.putTokens('../escape', { refreshToken: 'x' })).rejects.toThrow(/account/i);
  });
});
