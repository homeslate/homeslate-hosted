import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GoogleTokens, TokenStore } from '@homeslate/google';

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
    await mkdir(this.dir, { recursive: true });
    const path = this.pathFor(accountId);
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(tokens), 'utf8');
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
