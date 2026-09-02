import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileDisplayStore } from './fileDisplayStore';
import { createEmptyDisplayDocument } from './emptyDocument';
import { DisplayNotFoundError, InvalidDisplayDocumentError } from './types';

describe('FileDisplayStore', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function store() {
    dir = await mkdtemp(join(tmpdir(), 'homeslate-file-'));
    return new FileDisplayStore({ dir: join(dir, 'store') });
  }

  async function writeExternalRecord() {
    const record = {
      id: '../secret',
      publicId: 'public-secret',
      document: createEmptyDisplayDocument('Secret'),
    };
    const path = join(dir, 'secret.json');
    await writeFile(path, JSON.stringify(record), 'utf8');
    return { path, record };
  }

  it('create, get, getByPublicId, list, put, remove round-trip', async () => {
    const displays = await store();
    const created = await displays.create(createEmptyDisplayDocument('Kitchen'));
    expect(created.publicId).toEqual(expect.any(String));
    expect(await displays.get(created.id)).toEqual(created);
    expect(await displays.getByPublicId(created.publicId)).toEqual(created);
    expect(await displays.list()).toEqual([{ id: created.id, name: 'Kitchen' }]);

    const next = { ...created.document, name: 'Patio' };
    await displays.put(created.id, next);
    expect((await displays.get(created.id))?.document.name).toBe('Patio');
    expect(await displays.list()).toEqual([{ id: created.id, name: 'Patio' }]);

    await displays.remove(created.id);
    expect(await displays.get(created.id)).toBeNull();
    expect(await displays.list()).toEqual([]);
  });

  it('put rejects invalid documents and leaves the stored document unchanged', async () => {
    const displays = await store();
    const created = await displays.create(createEmptyDisplayDocument('Kitchen'));
    await expect(
      displays.put(created.id, { schemaVersion: 1, name: 'x', views: 'nope' } as never),
    ).rejects.toBeInstanceOf(InvalidDisplayDocumentError);
    expect((await displays.get(created.id))?.document.name).toBe('Kitchen');
  });

  it('put throws DisplayNotFoundError for an unknown id', async () => {
    const displays = await store();
    await expect(
      displays.put('missing', createEmptyDisplayDocument()),
    ).rejects.toBeInstanceOf(DisplayNotFoundError);
  });

  it('get rejects an id that escapes the store directory', async () => {
    const displays = await store();
    await writeExternalRecord();

    await expect(displays.get('../secret')).rejects.toThrow('Invalid display id');
  });

  it('put rejects an escaping id without changing the external file', async () => {
    const displays = await store();
    const { path, record } = await writeExternalRecord();

    await expect(
      displays.put('../secret', createEmptyDisplayDocument('Changed')),
    ).rejects.toThrow('Invalid display id');
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(record);
  });

  it('remove rejects an escaping id without deleting the external file', async () => {
    const displays = await store();
    const { path, record } = await writeExternalRecord();

    await expect(displays.remove('../secret')).rejects.toThrow('Invalid display id');
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(record);
  });
});
