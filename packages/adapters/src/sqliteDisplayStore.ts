import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { DisplayDocument } from '@homeslate/schema';
import {
  DisplayNotFoundError,
  type DisplayRecord,
  type DisplayStore,
  type DisplaySummary,
} from './types';
import { assertValidDisplayDocument } from './validateDocument';

type DisplayRow = {
  id: string;
  public_id: string;
  document: string;
};

export class SqliteDisplayStore implements DisplayStore {
  private readonly database: DatabaseSync;

  constructor(opts: { database: DatabaseSync }) {
    this.database = opts.database;
  }

  async get(id: string): Promise<DisplayRecord | null> {
    const row = this.database
      .prepare('SELECT id, public_id, document FROM displays WHERE id = ?')
      .get(id) as DisplayRow | undefined;
    return row ? recordFromRow(row) : null;
  }

  async getByPublicId(publicId: string): Promise<DisplayRecord | null> {
    const row = this.database
      .prepare('SELECT id, public_id, document FROM displays WHERE public_id = ?')
      .get(publicId) as DisplayRow | undefined;
    return row ? recordFromRow(row) : null;
  }

  async put(id: string, document: DisplayDocument): Promise<void> {
    const existing = this.database.prepare('SELECT id FROM displays WHERE id = ?').get(id);
    if (!existing) throw new DisplayNotFoundError(id);

    const validDocument = assertValidDisplayDocument(document);
    this.database
      .prepare('UPDATE displays SET name = ?, document = ? WHERE id = ?')
      .run(validDocument.name, JSON.stringify(validDocument), id);
  }

  async create(document: DisplayDocument): Promise<DisplayRecord> {
    const record = {
      id: randomUUID(),
      publicId: randomUUID(),
      document: assertValidDisplayDocument(document),
    };
    this.database
      .prepare('INSERT INTO displays (id, public_id, name, document) VALUES (?, ?, ?, ?)')
      .run(record.id, record.publicId, record.document.name, JSON.stringify(record.document));
    return record;
  }

  async list(): Promise<DisplaySummary[]> {
    const rows = this.database
      .prepare('SELECT id, public_id, document FROM displays')
      .all() as DisplayRow[];
    return rows
      .map(recordFromRow)
      .map((record) => ({ id: record.id, name: record.document.name }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async remove(id: string): Promise<void> {
    this.database.prepare('DELETE FROM displays WHERE id = ?').run(id);
  }
}

function recordFromRow(row: DisplayRow): DisplayRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    document: assertValidDisplayDocument(JSON.parse(row.document)),
  };
}
