import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GoogleTokens, TokenStore } from '@homeslate/google';

/** Refresh tokens are long-lived credentials; keep them owner-only on disk. */
const TOKEN_DIR_MODE = 0o700;
const TOKEN_FILE_MODE = 0o600;

export class FileTokenStore implements TokenStore {
  private readonly dir: string;

  constructor(opts: { dir: string }) {
    this.dir = opts.dir;
  }

  async getRefreshToken(accountId: string): Promise<string | null> {
    return (await this.getTokens(accountId))?.refreshToken ?? null;
  }

  async getTokens(accountId: string): Promise<GoogleTokens | null> {
    try {
      return JSON.parse(await readFile(this.pathFor(accountId), 'utf8')) as GoogleTokens;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async putTokens(accountId: string, tokens: GoogleTokens): Promise<void> {
    const path = this.pathFor(accountId);
    await mkdir(this.dir, { recursive: true, mode: TOKEN_DIR_MODE });
    // mkdir only applies the mode when it creates the directory.
    await chmod(this.dir, TOKEN_DIR_MODE);
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(tokens), {
      encoding: 'utf8',
      mode: TOKEN_FILE_MODE,
    });
    // writeFile only applies the mode when it creates the file.
    await chmod(temporaryPath, TOKEN_FILE_MODE);
    await rename(temporaryPath, path);
  }

  async deleteTokens(accountId: string): Promise<void> {
    try {
      await unlink(this.pathFor(accountId));
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  private pathFor(accountId: string): string {
    if (accountId.includes('/') || accountId.includes('\\') || accountId.includes('..')) {
      throw new Error(`Invalid account id: ${accountId}`);
    }
    return join(this.dir, `${accountId}.json`);
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
