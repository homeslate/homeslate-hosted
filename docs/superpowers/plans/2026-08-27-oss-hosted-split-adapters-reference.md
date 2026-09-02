# OSS Hosted Split — Phase 5: Adapters And Reference App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `@homeslate/adapters` (file + sqlite `DisplayStore`, file `TokenStore`, sqlite `GoogleBindingStore`) and a clone-and-run `apps/reference` that serves editor + display + optional calendar-on-a-wall.

**Architecture:** Persistence interfaces live in the adapters package (`DisplayStore`) or already in `@homeslate/google` (`TokenStore`, `GoogleBindingStore`). Implementations are Node-only and React-free. `apps/reference` is a new host: Hono HTTP + Vite UI that imports `@homeslate/editor` / `@homeslate/display` and persists whole documents. The existing Vite/Netlify/Neon app stays the hosted consumer and is not rewired this phase.

**Tech Stack:** TypeScript 5.9, Vitest 3, npm workspaces, Vite 7, React 19, Mantine 8, Hono 4, `@hono/node-server`, Node 22 `node:sqlite` (`DatabaseSync`), `uuid`.

**Spec:** `docs/superpowers/specs/2026-08-27-oss-hosted-split-design.md`

## Global Constraints

- OSS packages: `schema`, `widgets`, `editor`, `display`, `google`, `adapters`. Do not add a seventh UI package.
- `@homeslate/schema` does not do persistence, auth, or React.
- `@homeslate/adapters` ships `FileDisplayStore`, `SqliteDisplayStore`, `FileTokenStore`, and a sqlite `GoogleBindingStore`. It does not implement hosted quota or encryption-at-rest policy.
- `DisplayStore.put` MUST reject invalid documents; the store is unchanged on failure.
- Hosts run migrate on read. Adapters migrate then validate on `create` / `put`.
- Todos and notes stay fields on the document. OSS adapters are not required to expose widget-path PATCH; the reference app persists by replacing the whole document.
- OSS binding is one Google `accountId` per display. The reference app uses `"local"` for that account.
- `@homeslate/google` does not import an HTTP framework. The reference host wraps `createGoogleClient` in Hono routes.
- `createGoogleClient` throws `Missing Google OAuth credentials` when `clientId` or `clientSecret` is missing/blank. The reference app still serves editor/display without Google when those env vars are unset.
- `getAccessToken` throws typed `GoogleAuthError` on `invalid_grant`; the host maps that to “Reconnect Google” (`DISPLAY_GOOGLE_RECONNECT_MESSAGE` from `@homeslate/widgets`, reason `invalid_grant`).
- OSS adapters never implement entitlements. No billing, quota, or Homeslate-account code in public packages.
- Identity, Stripe, Neon, Netlify, pairing, passcodes, and collaborator token pooling stay in the current Vite app. Do not import `AuthContext`, `apiClient`, `dashboardStore`, Neon, drizzle, or Netlify from `packages/adapters` or `apps/reference`.
- Do not greenfield-rewrite the hosted app. Do not start Phase 6 (private hosted repo / entitlements) in this plan.
- MIT public packages; adapters and the reference app are public-core.
- Reference app: not required to have full E2E; smoke that it boots and loads a fixture document (spec Testing).
- Local-only without a server remains valid as an embedding path: `FileDisplayStore` is tested and exported. Do not build a second file-only SPA; sqlite + HTTP is the clone-and-run default.

## Plan series (this file is Phase 5 only)

Phases 1–4 are done. Do not start Phase 6 until this plan’s tests pass and `apps/reference` serves editor + display from a fixture.

| Phase | Plan file | Delivers |
|---|---|---|
| 1 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-schema.md` (done) | `@homeslate/schema`, v0→v1, live API persists v1 |
| 2 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-google.md` (done) | `@homeslate/google`, thin Netlify wrappers |
| 3 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-widgets.md` (done) | `@homeslate/widgets` + `registerWidget()` + built-in `configSchema`s |
| 4 | `docs/superpowers/plans/2026-08-27-oss-hosted-split-editor-display.md` (done) | `@homeslate/editor` + `@homeslate/display` |
| 5 | this file | `@homeslate/adapters` + `apps/reference` |
| 6 | not written yet | hosted entitlements + private repo split |

## Why sqlite is `node:sqlite`

Spec default for `apps/reference` is sqlite. Node 22.13+ ships `node:sqlite` (`DatabaseSync`) so the adapter needs no native `better-sqlite3` build. File adapters cover older Node / embedders. Require Node `>=22.13` in `packages/adapters/package.json` `engines`.

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/adapters/package.json` | `@homeslate/adapters`; `engines.node >=22.13` |
| `packages/adapters/src/index.ts` | Public exports |
| `packages/adapters/src/types.ts` | `DisplaySummary`, `DisplayRecord`, `DisplayStore`, errors |
| `packages/adapters/src/validateDocument.ts` | migrate + validate; throw `InvalidDisplayDocumentError` |
| `packages/adapters/src/emptyDocument.ts` | `createEmptyDisplayDocument(name?)` |
| `packages/adapters/src/fileDisplayStore.ts` | `FileDisplayStore` — one JSON file per display |
| `packages/adapters/src/fileTokenStore.ts` | `FileTokenStore` |
| `packages/adapters/src/sqlite.ts` | open DB, create tables |
| `packages/adapters/src/sqliteDisplayStore.ts` | `SqliteDisplayStore` |
| `packages/adapters/src/sqliteGoogleBindingStore.ts` | sqlite `GoogleBindingStore` |
| `packages/adapters/src/*.test.ts` | temp-dir / temp-file tests |
| `apps/reference/package.json` | reference host |
| `apps/reference/src/server/app.ts` | Hono app factory (testable via `app.request`) |
| `apps/reference/src/server/listen.ts` | `serve()` entry |
| `apps/reference/src/server/google.ts` | optional `createGoogleClient` + calendar/photo/OAuth routes |
| `apps/reference/src/web/main.tsx` | Vite entry |
| `apps/reference/src/web/App.tsx` | routes: list, editor, kiosk |
| `apps/reference/vite.config.ts` | aliases + `/api` proxy to Hono |
| `apps/reference/README.md` | clone-and-run |
| Modify: root `package.json` workspaces | `"packages/*", "apps/*"` |
| Modify: `tsconfig.app.json`, `vite.config.ts`, `vitest.config.ts` | `@homeslate/adapters` resolve + vitest include |
| Modify: phase 1–4 plan series tables + spec extraction step 5 | point at this file |

Keep unchanged this plan: `src/**` hosted Vite app (Auth, Netlify, Neon, `dashboardStore` `layouts`), `netlify/functions/**`, `packages/schema`, `packages/google` interfaces (implementations only in adapters), editor/display package APIs.

---

### Task 1: Adapters Package Entry And DisplayStore Types

**Files:**
- Modify: `package.json` (root workspaces stay `packages/*` until Task 6; no `apps/*` yet)
- Modify: `tsconfig.app.json`
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`
- Create: `packages/adapters/package.json`
- Create: `packages/adapters/src/index.ts`
- Create: `packages/adapters/src/types.ts`
- Create: `packages/adapters/src/emptyDocument.ts`
- Create: `packages/adapters/src/validateDocument.ts`
- Test: `packages/adapters/src/index.test.ts`
- Test: `packages/adapters/src/emptyDocument.test.ts`
- Test: `packages/adapters/src/validateDocument.test.ts`
- Test: `packages/adapters/src/hostImports.test.ts`

**Interfaces:**
- Consumes: `@homeslate/schema` `DisplayDocument`, `validateDisplayDocument`, `migrateDisplayDocument`, `DisplayValidationError`; `@homeslate/widgets/schemas` side-effect register
- Produces:

```ts
export const ADAPTERS_PACKAGE_NAME = '@homeslate/adapters';

export type DisplaySummary = {
  id: string;
  name: string;
};

export type DisplayRecord = {
  id: string;
  publicId: string;
  document: DisplayDocument;
};

export interface DisplayStore {
  get(id: string): Promise<DisplayRecord | null>;
  getByPublicId(publicId: string): Promise<DisplayRecord | null>;
  put(id: string, document: DisplayDocument): Promise<void>;
  create(document: DisplayDocument): Promise<DisplayRecord>;
  list(): Promise<DisplaySummary[]>;
  remove(id: string): Promise<void>;
}

export class InvalidDisplayDocumentError extends Error {
  readonly errors: DisplayValidationError[];
}

export class DisplayNotFoundError extends Error {
  readonly id: string;
}

export function createEmptyDisplayDocument(name?: string): DisplayDocument;
export function assertValidDisplayDocument(raw: unknown): DisplayDocument;
```

- [ ] **Step 1: Write the failing tests**

Create `packages/adapters/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ADAPTERS_PACKAGE_NAME } from '@homeslate/adapters';

describe('@homeslate/adapters', () => {
  it('is importable by package name', () => {
    expect(ADAPTERS_PACKAGE_NAME).toBe('@homeslate/adapters');
  });
});
```

Create `packages/adapters/src/emptyDocument.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyDisplayDocument } from './emptyDocument';
import { validateDisplayDocument } from '@homeslate/schema';

describe('createEmptyDisplayDocument', () => {
  it('returns a v1 document that validates', () => {
    const document = createEmptyDisplayDocument('Kitchen');
    expect(document.schemaVersion).toBe(1);
    expect(document.name).toBe('Kitchen');
    expect(document.views).toHaveLength(1);
    expect(document.views[0].name).toBe('Main');
    expect(document.activeViewId).toBe(document.views[0].id);
    expect(validateDisplayDocument(document).ok).toBe(true);
  });
});
```

Create `packages/adapters/src/validateDocument.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assertValidDisplayDocument, InvalidDisplayDocumentError } from './validateDocument';
import { createEmptyDisplayDocument } from './emptyDocument';

describe('assertValidDisplayDocument', () => {
  it('returns a migrated document when valid', () => {
    const document = assertValidDisplayDocument(createEmptyDisplayDocument());
    expect(document.schemaVersion).toBe(1);
  });

  it('throws InvalidDisplayDocumentError when views is not an array', () => {
    expect(() =>
      assertValidDisplayDocument({ schemaVersion: 1, name: 'x', views: 'nope' }),
    ).toThrow(InvalidDisplayDocumentError);
  });
});
```

Create `packages/adapters/src/hostImports.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HOST_IMPORT_RE = /AuthContext|apiClient|dashboardStore|from ['"]@?neon|from ['"]drizzle-orm|from ['"][^'"]*netlify/;

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkSourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

describe('@homeslate/adapters host imports', () => {
  it('matches neon and drizzle import specifiers, not canvas ids', () => {
    expect("import { neon } from '@neondatabase/serverless'").toMatch(HOST_IMPORT_RE);
    expect("import { neon } from 'drizzle-orm/neon-http'").toMatch(HOST_IMPORT_RE);
    expect("import { schedule } from '@netlify/functions'").toMatch(HOST_IMPORT_RE);
    expect('id: "neon"').not.toMatch(HOST_IMPORT_RE);
    expect("const neon = 'ok'").not.toMatch(HOST_IMPORT_RE);
  });

  it('does not import hosted auth, api, store, neon, or netlify', () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const files = walkSourceFiles(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(HOST_IMPORT_RE);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/adapters/src/index.test.ts`

Expected: FAIL — cannot resolve `@homeslate/adapters`.

- [ ] **Step 3: Create the package and wire resolution**

`packages/adapters/package.json`:

```json
{
  "name": "@homeslate/adapters",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.13" },
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@homeslate/schema": "*",
    "@homeslate/widgets": "*",
    "uuid": "^13.0.0"
  }
}
```

`packages/adapters/src/types.ts`:

```ts
import type { DisplayDocument, DisplayValidationError } from '@homeslate/schema';

export type DisplaySummary = {
  id: string;
  name: string;
};

export type DisplayRecord = {
  id: string;
  publicId: string;
  document: DisplayDocument;
};

export interface DisplayStore {
  get(id: string): Promise<DisplayRecord | null>;
  getByPublicId(publicId: string): Promise<DisplayRecord | null>;
  put(id: string, document: DisplayDocument): Promise<void>;
  create(document: DisplayDocument): Promise<DisplayRecord>;
  list(): Promise<DisplaySummary[]>;
  remove(id: string): Promise<void>;
}

export class InvalidDisplayDocumentError extends Error {
  readonly errors: DisplayValidationError[];
  constructor(errors: DisplayValidationError[]) {
    super('Invalid display document');
    this.name = 'InvalidDisplayDocumentError';
    this.errors = errors;
  }
}

export class DisplayNotFoundError extends Error {
  readonly id: string;
  constructor(id: string) {
    super(`Display not found: ${id}`);
    this.name = 'DisplayNotFoundError';
    this.id = id;
  }
}
```

`packages/adapters/src/emptyDocument.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { DisplayDocument } from '@homeslate/schema';

export function createEmptyDisplayDocument(name = 'Homeslate'): DisplayDocument {
  const viewId = randomUUID();
  return {
    schemaVersion: 1,
    name,
    views: [
      {
        id: viewId,
        name: 'Main',
        columns: 12,
        rowHeight: 80,
        widgets: [],
      },
    ],
    activeViewId: viewId,
    rotation: { enabled: false, intervalMs: 30000 },
    themes: [],
    activeThemeId: null,
    settings: {},
  };
}
```

`packages/adapters/src/validateDocument.ts`:

```ts
import '@homeslate/widgets/schemas';
import { validateDisplayDocument, type DisplayDocument } from '@homeslate/schema';
import { InvalidDisplayDocumentError } from './types';

export function assertValidDisplayDocument(raw: unknown): DisplayDocument {
  const result = validateDisplayDocument(raw);
  if (!result.ok) throw new InvalidDisplayDocumentError(result.errors);
  return result.document;
}
```

(`validateDisplayDocument` already migrates internally.)

`packages/adapters/src/index.ts`:

```ts
export const ADAPTERS_PACKAGE_NAME = '@homeslate/adapters';
export type { DisplayRecord, DisplayStore, DisplaySummary } from './types';
export { DisplayNotFoundError, InvalidDisplayDocumentError } from './types';
export { createEmptyDisplayDocument } from './emptyDocument';
export { assertValidDisplayDocument } from './validateDocument';
```

Add path aliases in `tsconfig.app.json`, `vite.config.ts`, and `vitest.config.ts` (same pattern as `@homeslate/schema`). Include `packages/adapters/src` in `tsconfig.app.json` `include` and `packages/adapters/src/**/*.test.ts` in vitest `include`.

Run `npm install` at the repo root so the workspace package links.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run packages/adapters
npx tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.app.json vite.config.ts vitest.config.ts packages/adapters
git commit -m "$(cat <<'EOF'
chore: add @homeslate/adapters workspace package

EOF
)"
```

---

### Task 2: FileDisplayStore

**Files:**
- Create: `packages/adapters/src/fileDisplayStore.ts`
- Modify: `packages/adapters/src/index.ts`
- Test: `packages/adapters/src/fileDisplayStore.test.ts`

**Interfaces:**
- Consumes: `DisplayStore`, `assertValidDisplayDocument`, `DisplayNotFoundError`, `createEmptyDisplayDocument`
- Produces:

```ts
export class FileDisplayStore implements DisplayStore {
  constructor(opts: { dir: string });
}
```

On-disk layout: `{dir}/{id}.json` containing a `DisplayRecord`. `getByPublicId` reads all JSON files. Writes are atomic (`writeFile` to `{id}.json.tmp` then `rename`). `put` on a missing id throws `DisplayNotFoundError`. `create` assigns `randomUUID()` for `id` and `publicId`. `remove` is a no-op if the file is missing. `list` returns `{ id, name: record.document.name }` sorted by name then id.

- [ ] **Step 1: Write the failing test**

Create `packages/adapters/src/fileDisplayStore.test.ts`:

```ts
import { mkdtemp, rm } from 'node:fs/promises';
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
    return new FileDisplayStore({ dir });
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/src/fileDisplayStore.test.ts`

Expected: FAIL — `FileDisplayStore` not exported.

- [ ] **Step 3: Implement FileDisplayStore**

Use `node:fs/promises` (`readdir`, `readFile`, `writeFile`, `rename`, `mkdir`, `unlink`). Parse JSON as `DisplayRecord`. On read, run `assertValidDisplayDocument(record.document)` and replace `document` with the returned value (migrate-on-read). Skip files that are not `*.json`.

Export `FileDisplayStore` from `index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run packages/adapters
npx tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters
git commit -m "$(cat <<'EOF'
feat: add FileDisplayStore

EOF
)"
```

---

### Task 3: FileTokenStore

**Files:**
- Create: `packages/adapters/src/fileTokenStore.ts`
- Modify: `packages/adapters/package.json` — add `"@homeslate/google": "*"`
- Modify: `packages/adapters/src/index.ts`
- Test: `packages/adapters/src/fileTokenStore.test.ts`

**Interfaces:**
- Consumes: `TokenStore` and `GoogleTokens` from `@homeslate/google`
- Produces:

```ts
export class FileTokenStore implements TokenStore {
  constructor(opts: { dir: string });
}
```

On-disk: `{dir}/{accountId}.json` storing `GoogleTokens`. `getRefreshToken` returns `getTokens(accountId)?.refreshToken ?? null`. `deleteTokens` unlinks if present. Sanitize `accountId` so it cannot escape `dir` (reject `/`, `\\`, `..`).

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/src/fileTokenStore.test.ts`

Expected: FAIL — `FileTokenStore` not exported.

- [ ] **Step 3: Implement FileTokenStore**

Export from `index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/adapters && npx tsc -b --pretty false`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters
git commit -m "$(cat <<'EOF'
feat: add FileTokenStore

EOF
)"
```

---

### Task 4: SqliteDisplayStore And SqliteGoogleBindingStore

**Files:**
- Create: `packages/adapters/src/sqlite.ts`
- Create: `packages/adapters/src/sqliteDisplayStore.ts`
- Create: `packages/adapters/src/sqliteGoogleBindingStore.ts`
- Modify: `packages/adapters/src/index.ts`
- Test: `packages/adapters/src/sqliteDisplayStore.test.ts`
- Test: `packages/adapters/src/sqliteGoogleBindingStore.test.ts`

**Interfaces:**
- Consumes: `DisplayStore`, `GoogleBindingStore` from `@homeslate/google`, `assertValidDisplayDocument`
- Produces:

```ts
import { DatabaseSync } from 'node:sqlite';

export function openSqlite(filename: string): DatabaseSync;

export class SqliteDisplayStore implements DisplayStore {
  constructor(opts: { database: DatabaseSync });
}

export class SqliteGoogleBindingStore implements GoogleBindingStore {
  constructor(opts: { database: DatabaseSync });
}
```

`openSqlite` creates the file’s parent dir, opens `DatabaseSync`, and `exec`s:

```sql
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
```

Use `database.prepare(...).get / .all / .run`. JSON-serialize `document`. On read, `assertValidDisplayDocument(JSON.parse(document))`. Same `put` / `create` / `remove` / `list` semantics as `FileDisplayStore` (including `DisplayNotFoundError` and unchanged-on-invalid-put). `SqliteGoogleBindingStore.getAccountIdForDisplay` returns `null` when unbound; `setAccountIdForDisplay` upserts.

Do not auto-bind `"local"` inside `SqliteDisplayStore.create` — that wiring belongs to the reference app (Task 5).

- [ ] **Step 1: Write the failing tests**

Create `packages/adapters/src/sqliteDisplayStore.test.ts`:

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openSqlite } from './sqlite';
import { SqliteDisplayStore } from './sqliteDisplayStore';
import { createEmptyDisplayDocument } from './emptyDocument';
import { DisplayNotFoundError, InvalidDisplayDocumentError } from './types';

describe('SqliteDisplayStore', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function store() {
    dir = await mkdtemp(join(tmpdir(), 'homeslate-sqlite-'));
    return new SqliteDisplayStore({ database: openSqlite(join(dir, 'ref.sqlite')) });
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
});
```

Create `packages/adapters/src/sqliteGoogleBindingStore.test.ts`:

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openSqlite } from './sqlite';
import { SqliteGoogleBindingStore } from './sqliteGoogleBindingStore';

describe('SqliteGoogleBindingStore', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('set and get account id for a display', async () => {
    dir = await mkdtemp(join(tmpdir(), 'homeslate-bind-'));
    const bindings = new SqliteGoogleBindingStore({
      database: openSqlite(join(dir, 'ref.sqlite')),
    });
    expect(await bindings.getAccountIdForDisplay('d1')).toBeNull();
    await bindings.setAccountIdForDisplay('d1', 'local');
    expect(await bindings.getAccountIdForDisplay('d1')).toBe('local');
    await bindings.setAccountIdForDisplay('d1', 'other');
    expect(await bindings.getAccountIdForDisplay('d1')).toBe('other');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/adapters/src/sqliteDisplayStore.test.ts packages/adapters/src/sqliteGoogleBindingStore.test.ts`

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement sqlite helpers and stores**

Export `openSqlite`, `SqliteDisplayStore`, `SqliteGoogleBindingStore` from `index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/adapters && npx tsc -b --pretty false`

Expected: PASS. If `node:sqlite` is missing, stop and report — do not silently switch to `better-sqlite3` without updating this plan.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters
git commit -m "$(cat <<'EOF'
feat: add sqlite display and Google binding stores

EOF
)"
```

---

### Task 5: Reference Hono App (Document + Calendar Routes)

**Files:**
- Modify: root `package.json` — `"workspaces": ["packages/*", "apps/*"]`
- Create: `apps/reference/package.json`
- Create: `apps/reference/src/server/app.ts`
- Create: `apps/reference/src/server/paths.ts`
- Create: `apps/reference/src/server/google.ts`
- Test: `apps/reference/src/server/app.test.ts`
- Modify: `vitest.config.ts` — include `apps/reference/src/**/*.test.ts` and alias `@homeslate/adapters`

**Interfaces:**
- Consumes: Task 1–4 stores; `createGoogleClient`, `isGoogleAuthError` from `@homeslate/google`; `DISPLAY_GOOGLE_RECONNECT_MESSAGE` / `DISPLAY_OWNER_SIGN_IN_MESSAGE` from `@homeslate/widgets`
- Produces:

```ts
export const REFERENCE_LOCAL_ACCOUNT_ID = 'local';

export type ReferenceAppOptions = {
  dataDir: string;
  googleClientId?: string;
  googleClientSecret?: string;
  publicBaseUrl?: string; // default http://127.0.0.1:8787
};

export function createReferenceApp(opts: ReferenceAppOptions): Hono;
```

`dataDir` layout:

- `{dataDir}/displays.sqlite` — `openSqlite`
- `{dataDir}/tokens/` — `FileTokenStore`

On `createReferenceApp`, open sqlite, construct `SqliteDisplayStore`, `SqliteGoogleBindingStore`, `FileTokenStore`. If `googleClientId` and `googleClientSecret` are both non-blank, call `createGoogleClient`; otherwise leave Google disabled (do not throw).

Routes (JSON):

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/displays` | `list()` |
| POST | `/api/displays` | body optional `{ document? }`; default `createEmptyDisplayDocument()`; `create`; `setAccountIdForDisplay(id, "local")`; 201 + `DisplayRecord` |
| GET | `/api/displays/:id` | 404 if missing |
| PUT | `/api/displays/:id` | body is `DisplayDocument`; 400 `{ errors }` on `InvalidDisplayDocumentError`; 404 on `DisplayNotFoundError` |
| DELETE | `/api/displays/:id` | `remove` |
| GET | `/api/public/:publicId` | `{ document }` for kiosk; 404 if missing |
| PUT | `/api/public/:publicId` | whole-document persist for kiosk `onChange`; same 400/404 |
| GET | `/api/display-calendar` | query `displayId` (this is `publicId`), `calendarIds`, `daysAhead` — widget contract from `displayCalendarUrl` |
| GET | `/api/google/connect` | 404 if Google disabled; else 302 to Google OAuth |
| GET | `/api/google/callback` | exchange code for `"local"`; 302 `/` |
| GET | `/api/google/session` | `{ accessToken }` or `{ accessToken: null }` |

`display-calendar` behavior:

- Missing `displayId` or `calendarIds` → 400 `{ error: 'Missing displayId or calendarIds', reason: 'missing_params' }` (same as hosted `netlify/functions/display-calendar.ts`).
- Unknown public id → 404 `{ error: 'Display not found' }`.
- Google disabled or no tokens → 200 `{ events: [], calendars: [], error: DISPLAY_OWNER_SIGN_IN_MESSAGE }` so widgets show the existing empty/reconnect state and do not crash.
- Bound account + tokens: `listCalendars` / `listEvents` with `timeMin=now`, `timeMax=now+daysAhead` (clamp 1..90 like hosted).
- `GoogleAuthError` with `invalid_grant` or `token_revoked` → 401 `{ error: DISPLAY_GOOGLE_RECONNECT_MESSAGE, reason: err.code }`.
- Other Google errors → 502 `{ error: err.message, reason: err.code }`.

OAuth: `scope=https://www.googleapis.com/auth/calendar&access_type=offline&prompt=consent`. Redirect URI `{publicBaseUrl}/api/google/callback`. Do not add Photos Picker this phase.

Do not import Netlify, Neon, or `src/contexts/AuthContext`.

- [ ] **Step 1: Write the failing test**

`apps/reference/src/server/app.test.ts`:

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyDisplayDocument } from '@homeslate/adapters';
import { createReferenceApp } from './app';

describe('createReferenceApp', () => {
  let dataDir = '';
  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  async function app() {
    dataDir = await mkdtemp(join(tmpdir(), 'homeslate-ref-'));
    return createReferenceApp({ dataDir });
  }

  it('creates a fixture display and returns it from GET /api/displays', async () => {
    const hono = await app();
    const created = await hono.request('/api/displays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: createEmptyDisplayDocument('Kitchen') }),
    });
    expect(created.status).toBe(201);
    const record = await created.json() as { id: string; publicId: string; document: { name: string } };
    expect(record.document.name).toBe('Kitchen');

    const list = await hono.request('/api/displays');
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([{ id: record.id, name: 'Kitchen' }]);

    const kiosk = await hono.request(`/api/public/${record.publicId}`);
    expect(kiosk.status).toBe(200);
    expect((await kiosk.json() as { document: { name: string } }).document.name).toBe('Kitchen');
  });

  it('PUT invalid document returns 400 and leaves the store unchanged', async () => {
    const hono = await app();
    const created = await hono.request('/api/displays', { method: 'POST' });
    const record = await created.json() as { id: string; document: { name: string } };
    const put = await hono.request(`/api/displays/${record.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, name: 'x', views: 'nope' }),
    });
    expect(put.status).toBe(400);
    const again = await hono.request(`/api/displays/${record.id}`);
    expect((await again.json() as { document: { name: string } }).document.name).toBe(record.document.name);
  });

  it('display-calendar without Google still returns the empty widget payload', async () => {
    const hono = await app();
    const created = await hono.request('/api/displays', { method: 'POST' });
    const record = await created.json() as { publicId: string };
    const cal = await hono.request(
      `/api/display-calendar?displayId=${record.publicId}&calendarIds=primary&daysAhead=7`,
    );
    expect(cal.status).toBe(200);
    const body = await cal.json() as { events: unknown[]; calendars: unknown[]; error: string };
    expect(body.events).toEqual([]);
    expect(body.calendars).toEqual([]);
    expect(body.error).toMatch(/sign in with Google/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/reference/src/server/app.test.ts`

Expected: FAIL — `createReferenceApp` not found.

- [ ] **Step 3: Implement the Hono app**

`apps/reference/package.json`:

```json
{
  "name": "homeslate-reference",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --import tsx src/server/listen.ts",
    "start": "node --import tsx src/server/listen.ts"
  },
  "dependencies": {
    "@homeslate/adapters": "*",
    "@homeslate/display": "*",
    "@homeslate/editor": "*",
    "@homeslate/google": "*",
    "@homeslate/schema": "*",
    "@homeslate/widgets": "*",
    "@hono/node-server": "^1.14.0",
    "@mantine/core": "^8.3.10",
    "@tabler/icons-react": "^3.35.0",
    "hono": "^4.7.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "tsx": "^4.20.0"
  }
}
```

Pin `hono` / `@hono/node-server` / `tsx` to whatever `npm install` resolves in the workspace; do not invent incompatible majors.

`createReferenceApp` returns `new Hono()`. Use `c.req.param`, `c.req.query`, `c.json`, `c.redirect`.

Add `@homeslate/adapters` to vitest aliases. Run `npm install` at root.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/adapters apps/reference && npx tsc -b --pretty false`

Expected: PASS. If `tsc -b` does not include `apps/reference`, add `apps/reference/tsconfig.json` referenced from root `tsconfig.json`, or keep the app typechecked via `npx tsc -p apps/reference --pretty false` and record that command in this step.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.app.json apps/reference packages/adapters
git commit -m "$(cat <<'EOF'
feat: add reference Hono app for document and calendar routes

EOF
)"
```

---

### Task 6: Reference Vite UI (Editor + Display)

**Files:**
- Create: `apps/reference/index.html`
- Create: `apps/reference/src/web/main.tsx`
- Create: `apps/reference/src/web/App.tsx`
- Create: `apps/reference/src/web/ReferenceGoogleRuntime.tsx`
- Create: `apps/reference/src/server/listen.ts`
- Create: `apps/reference/vite.config.ts`
- Create: `apps/reference/README.md`
- Modify: `apps/reference/package.json` scripts — `"dev:web": "vite"`, `"dev":` run API + Vite (two scripts listed in README if not concurrent)
- Modify: root `package.json` — optional `"dev:reference": "npm run dev -w homeslate-reference"`
- Test: `apps/reference/src/web/App.test.ts` (source-scan)

**Interfaces:**
- Consumes: `Editor` from `@homeslate/editor`; `Display` from `@homeslate/display`; `GoogleRuntimeProvider` from `@homeslate/widgets`; Hono routes from Task 5
- Produces: a browser host with three routes

Routes:

- `/` — list `GET /api/displays`; button “New display” → `POST /api/displays` → navigate `/edit/:id`; links to editor and kiosk (`/d/:publicId`)
- `/edit/:id` — `GET /api/displays/:id`; mount `Editor` with `{ document, viewId: document.activeViewId ?? document.views[0].id, onChange }` where `onChange` `PUT`s the document; wrap in `MantineProvider` + `ReferenceGoogleRuntime`
- `/d/:publicId` — poll `GET /api/public/:publicId` every 10s; mount `Display` with `{ document, onChange }` where `onChange` `PUT`s `/api/public/:publicId`; `GoogleRuntime.displayId = publicId`, `kioskFetchBaseUrl = '/api'`

`ReferenceGoogleRuntime`: fetch `/api/google/session` on mount; `signIn` assigns `window.location.href = '/api/google/connect'`; `isAuthenticated` is `Boolean(accessToken)`.

`listen.ts`: `serve({ fetch: app.fetch, port: 8787 })` with `dataDir` default `./data` (gitignore `apps/reference/data`). Read `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from `process.env`. Seed: if `list()` is empty, `POST`-equivalent `create(createEmptyDisplayDocument())` + bind `"local"`.

Vite `server.proxy['/api']` → `http://127.0.0.1:8787`. Port 5174 so it does not collide with hosted `5173`. Copy package aliases from root `vite.config.ts` plus `@homeslate/adapters`.

README: Node 22.13+, `npm install`, `npx tsx apps/reference/src/server/listen.ts` in one terminal and `npx vite --config apps/reference/vite.config.ts` in another (or workspace scripts). Open `http://127.0.0.1:5174`. Optional env `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. No accounts, Stripe, or quotas.

Source-scan test: `App.tsx` matches `from '@homeslate/editor'` and `from '@homeslate/display'`, and does not match `AuthContext`, `dashboardStore`, `apiClient`, `netlify`, `drizzle-orm`.

Do not require jsdom. Do not implement photo-upload blobs or pairing.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('reference web host', () => {
  it('mounts Editor and Display from packages and does not import hosted auth', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/from '@homeslate\/editor'/);
    expect(source).toMatch(/from '@homeslate\/display'/);
    expect(source).not.toMatch(/AuthContext/);
    expect(source).not.toMatch(/dashboardStore/);
    expect(source).not.toMatch(/apiClient/);
    expect(source).not.toMatch(/netlify/);
    expect(source).not.toMatch(/drizzle-orm/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/reference/src/web/App.test.ts`

Expected: FAIL — `App.tsx` missing.

- [ ] **Step 3: Implement the UI and listen entry**

Keep chrome minimal: Mantine `AppShell` or a header with display name + “Open kiosk”. Debounce editor `PUT` at 400ms so typing does not hammer disk.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run
npx tsc -b --pretty false
```

Expected: full suite green (previous 325 plus new adapter/reference tests).

Manual smoke (human, not a merge blocker for this task’s automated tests): start API + Vite, open `/`, create/open editor, add a clock widget, reload, open `/d/:publicId` and see the clock.

- [ ] **Step 5: Commit**

```bash
git add apps/reference package.json
git commit -m "$(cat <<'EOF'
feat: add reference editor and display host

EOF
)"
```

---

### Task 7: Point Spec And Phase Plans At This File

**Files:**
- Modify: `docs/superpowers/specs/2026-08-27-oss-hosted-split-design.md` — extraction step 5 names this plan file
- Modify: series tables in the four earlier plan files — Phase 5 row becomes this file (not “not written yet”)

**Interfaces:**
- Consumes: this plan’s path
- Produces: docs that match shipped Phases 1–4 and in-progress Phase 5

- [ ] **Step 1: Write the failing assertion**

Add `docs/superpowers/plans/phaseSeries.test.ts` only if you would otherwise have no test — **do not**. This task is docs-only; skip a fake test.

- [ ] **Step 2: Update the documents**

Spec extraction item 5: `Add packages/adapters and apps/reference.` → append `Plan: docs/superpowers/plans/2026-08-27-oss-hosted-split-adapters-reference.md`.

In all four prior plans plus this file’s series table, Phase 5 `Plan file` is `docs/superpowers/plans/2026-08-27-oss-hosted-split-adapters-reference.md`. Leave Phase 6 as not written.

Spec Status blurb: Phase 5 plan written; implementation in progress until this plan’s tasks are checked off.

- [ ] **Step 3: Confirm no leftover “Phase 5 | not written yet” in `docs/superpowers`**

Run: `rg "not written yet" docs/superpowers`

Expected: only Phase 6 rows.

- [ ] **Step 4: Typecheck/tests still pass**

Run: `npx vitest run && npx tsc -b --pretty false`

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "$(cat <<'EOF'
docs: point OSS series tables at the adapters/reference plan

EOF
)"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| `DisplayStore` file + sqlite | 1–2, 4 |
| `put` rejects invalid; store unchanged | 2, 4, 5 |
| migrate on read | 2, 4 (`assertValidDisplayDocument`) |
| `FileTokenStore` | 3 |
| sqlite `GoogleBindingStore`; reference binds `"local"` | 4, 5 |
| `apps/reference` sqlite + HTTP + editor + display | 5, 6 |
| Optional GCP env; empty Google widgets without it | 5 |
| Host wraps google in HTTP; package has no Hono import | 5 (`packages/google` untouched) |
| `invalid_grant` → reconnect payload | 5 |
| No entitlements in OSS adapters | Global constraints; no entitlement types in adapters |
| Hosted Vite/Neon/Netlify unchanged | Keep-unchanged list |
| Adapters tests against temp dir/file | 2, 3, 4 |
| Reference smoke: boots and loads fixture | 5 POST/GET; 6 seed on listen |
| File-only without server remains valid | Task 2 export; no second SPA |
| Whole-document persist (no required PATCH) | 5 PUT |
| MIT, no billing in public packages | Global constraints + hostImports |

**Placeholder scan:** no TBD / “handle edge cases” / “similar to Task N”.

**Type consistency:** `DisplayStore` / `DisplayRecord` / `publicId` match the spec. Reference kiosk `displayId` query is `publicId` (same as today’s hosted `display_id`). `REFERENCE_LOCAL_ACCOUNT_ID` is `"local"`. `InvalidDisplayDocumentError` / `DisplayNotFoundError` are the HTTP 400/404 mapping.

**YAGNI held:** no Neon adapter, no entitlements, no photo-upload blobs, no pairing/passcodes, no `dashboardStore` `layouts` rename, no jsdom, no second file-only SPA, no Photos Picker in the reference OAuth scope.
