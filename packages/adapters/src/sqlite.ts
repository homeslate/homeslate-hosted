import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openSqlite(filename: string): DatabaseSync {
  mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec(`
CREATE TABLE IF NOT EXISTS displays (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  document TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS google_bindings (
  display_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL
);
`);
  return database;
}
