import { join } from 'node:path';

export function referenceDatabasePath(dataDir: string): string {
  return join(dataDir, 'displays.sqlite');
}

export function referenceTokensPath(dataDir: string): string {
  return join(dataDir, 'tokens');
}
