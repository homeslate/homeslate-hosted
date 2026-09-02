import { chmod, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileTokenStore } from './fileTokenStore';

const posixOnly = it.skipIf(process.platform === 'win32');

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

  posixOnly('creates the token directory and file owner-only', async () => {
    await store();
    const tokenDir = join(dir, 'tokens');
    const tokens = new FileTokenStore({ dir: tokenDir });

    await tokens.putTokens('local', { refreshToken: 'r1' });

    expect((await stat(tokenDir)).mode & 0o777).toBe(0o700);
    expect((await stat(join(tokenDir, 'local.json'))).mode & 0o777).toBe(0o600);
  });

  posixOnly('tightens modes on a directory and token file that already exist', async () => {
    await store();
    const tokenDir = join(dir, 'tokens');
    const tokens = new FileTokenStore({ dir: tokenDir });
    await mkdir(tokenDir, { recursive: true });
    await chmod(tokenDir, 0o755);
    await tokens.putTokens('local', { refreshToken: 'r1' });
    await chmod(tokenDir, 0o755);
    await chmod(join(tokenDir, 'local.json'), 0o644);

    await tokens.putTokens('local', { refreshToken: 'r2' });

    expect((await stat(tokenDir)).mode & 0o777).toBe(0o700);
    expect((await stat(join(tokenDir, 'local.json'))).mode & 0o777).toBe(0o600);
  });
});
