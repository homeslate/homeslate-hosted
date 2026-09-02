import type { GoogleBindingStore } from '@homeslate/google';
import type { DatabaseSync } from 'node:sqlite';

type GoogleBindingRow = {
  account_id: string;
};

export class SqliteGoogleBindingStore implements GoogleBindingStore {
  private readonly database: DatabaseSync;

  constructor(opts: { database: DatabaseSync }) {
    this.database = opts.database;
  }

  async getAccountIdForDisplay(displayId: string): Promise<string | null> {
    const row = this.database
      .prepare('SELECT account_id FROM google_bindings WHERE display_id = ?')
      .get(displayId) as GoogleBindingRow | undefined;
    return row?.account_id ?? null;
  }

  async setAccountIdForDisplay(displayId: string, accountId: string): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO google_bindings (display_id, account_id)
         VALUES (?, ?)
         ON CONFLICT(display_id) DO UPDATE SET account_id = excluded.account_id`,
      )
      .run(displayId, accountId);
  }
}
