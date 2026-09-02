import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DisplayDocument } from '@homeslate/schema';
import { assertValidDisplayDocument } from './validateDocument';
import {
  DisplayNotFoundError,
  type DisplayRecord,
  type DisplayStore,
  type DisplaySummary,
} from './types';

export class FileDisplayStore implements DisplayStore {
  private readonly dir: string;

  constructor(opts: { dir: string }) {
    this.dir = opts.dir;
  }

  async get(id: string): Promise<DisplayRecord | null> {
    return this.readRecord(id);
  }

  async getByPublicId(publicId: string): Promise<DisplayRecord | null> {
    for (const file of await this.jsonFiles()) {
      const record = await this.readRecord(file.slice(0, -'.json'.length));
      if (record?.publicId === publicId) return record;
    }
    return null;
  }

  async put(id: string, document: DisplayDocument): Promise<void> {
    const record = await this.readRecord(id);
    if (!record) throw new DisplayNotFoundError(id);

    const validDocument = assertValidDisplayDocument(document);
    await this.writeRecord({ ...record, document: validDocument });
  }

  async create(document: DisplayDocument): Promise<DisplayRecord> {
    const record = {
      id: randomUUID(),
      publicId: randomUUID(),
      document: assertValidDisplayDocument(document),
    };
    await this.writeRecord(record);
    return record;
  }

  async list(): Promise<DisplaySummary[]> {
    const summaries: DisplaySummary[] = [];
    for (const file of await this.jsonFiles()) {
      const record = await this.readRecord(file.slice(0, -'.json'.length));
      if (record) summaries.push({ id: record.id, name: record.document.name });
    }
    return summaries.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async remove(id: string): Promise<void> {
    try {
      await unlink(this.pathFor(id));
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  private async jsonFiles(): Promise<string[]> {
    try {
      return (await readdir(this.dir)).filter((file) => file.endsWith('.json'));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  private async readRecord(id: string): Promise<DisplayRecord | null> {
    try {
      const record = JSON.parse(await readFile(this.pathFor(id), 'utf8')) as DisplayRecord;
      return { ...record, document: assertValidDisplayDocument(record.document) };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  private async writeRecord(record: DisplayRecord): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const path = this.pathFor(record.id);
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(record), 'utf8');
    await rename(temporaryPath, path);
  }

  private pathFor(id: string): string {
    return join(this.dir, `${id}.json`);
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
