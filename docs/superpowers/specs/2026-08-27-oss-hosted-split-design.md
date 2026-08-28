# OSS / Hosted Split Design

## Goal

Split Homeslate so a public MIT core can be self-hosted (or embedded) on any storage and Google Cloud project, while a private hosted product consumes that core and adds accounts, billing, and free-tier limits. The public contract is a versioned display/theme JSON document; editor UI, display UI, built-in widgets, and Google Calendar/Photos helpers are packages driven by that document.

## Decisions

| Topic | Choice |
|---|---|
| Product model | Open libraries + thin reference app; hosted is a private consumer, not a fork |
| Public contract | Versioned `DisplayDocument` + existing `ThemeDocument` |
| OSS packages | `schema`, `widgets`, `editor`, `display`, `google`, `adapters` |
| Self-host path | Libraries + `apps/reference` (sqlite default, file token store) |
| Persistence | `DisplayStore` interface; OSS ships file + sqlite; hosted ships Neon |
| Google | Integration + `TokenStore`, not user identity; self-hosters bring their own GCP client |
| Kiosk calendar | Host HTTP routes call `@homeslate/google`; package does not bind Netlify/Express |
| Display ↔ Google account | OSS: one `accountId` per display. Collaborator token pooling stays hosted-only |
| Live widget data | Stays inside the document (todos, notes). Hosts may PATCH a widget path |
| Entitlements | Hosted `DisplayStore` only. OSS is unlimited. Limits are not in the document |
| UI rename in schema | Public schema uses `views` (today’s `layouts`) |
| Custom widgets | `registerWidget()`; unknown `type`s round-trip if instance shape is valid |
| License | MIT public packages + reference app; proprietary hosted app |
| Extraction | Carve packages from this repo; do not rewrite. Split hosted to a private repo before making this repo public |

## Chosen Approach

Publish a small set of packages whose seam is the display document. `@homeslate/editor` and `@homeslate/display` both render that document through `@homeslate/widgets`. Hosts persist it through `DisplayStore` and, if they want calendar-on-a-wall, implement `TokenStore` and wrap `@homeslate/google` in their own HTTP layer.

The hosted app is a different application in a private repo. It depends on the published packages and adds identity, Stripe, entitlements, our GCP OAuth client, encrypted tokens, and multi-tenant Neon. Free-tier limits (`maxDisplays`, `maxViewsPerDisplay`) are enforced on write in hosted storage, never in schema or UI packages.

Rejected alternatives:

- **Same single app with a billing flag** — Netlify/Neon/identity stay coupled; self-hosters cannot swap DB or skip accounts; hosted limits leak into OSS.
- **Thicker open-core that withholds widgets/features** — the public product would look incomplete; the hosted value today is managed infra and Google OAuth, not a different editor.
- **Public engine / private full SaaS rewrite** — two codebases will drift at this size; the editor and display *are* the product and belong in OSS.
- **Libraries with no reference app** — contradicts the primary self-host use case (clone and run).
- **Exporting Netlify handlers as the OSS server API** — ties every self-host to Netlify. Export runtime-agnostic functions instead.

## Package Map

```text
homeslate/                          # public MIT monorepo
  packages/schema                   # JSON Schema, types, validate, migrate
  packages/widgets                  # built-ins + registerWidget()
  packages/editor                   # admin/editor UI
  packages/display                  # kiosk viewer
  packages/google                   # token + calendar + photos helpers
  packages/adapters                 # FileDisplayStore, SqliteDisplayStore, FileTokenStore
  apps/reference                    # thin wiring example
  examples/custom-widget

homeslate-hosted/                   # private
  depends on @homeslate/*
  auth, billing, entitlements, orgs, our GCP app, Neon, Netlify wrappers
```

| Package | Does | Does not |
|---|---|---|
| `@homeslate/schema` | Document types, JSON Schema, `validateDisplayDocument`, `migrateDisplayDocument`, theme schema | Persistence, auth, React |
| `@homeslate/widgets` | Built-in components, settings, `registerWidget`, default registry | App shell, routing, stores |
| `@homeslate/editor` | View editor, widget add/settings, theme editor chrome driven by the document | Accounts, display list as a SaaS concept, billing |
| `@homeslate/display` | Kiosk viewer (rotation, alarms runtime, holiday effects) | Pairing-as-onboarding, passcodes as a product |
| `@homeslate/google` | Code exchange, refresh, calendar list/events, photo fetch helpers | User identity, HTTP framework, Postgres |
| `@homeslate/adapters` | Reference `DisplayStore`, `TokenStore`, and `GoogleBindingStore` implementations | Hosted quota, encryption-at-rest policy |

Editor and display take `{ document, onChange?, widgetRegistry }`. The host wraps them in a `GoogleRuntime` React context (access token for the editor session, kiosk fetch base URL for the display). Neither package imports a database.

Someone building their own UI can depend on `@homeslate/schema` + `@homeslate/widgets` only.

## Display Document

The portable unit is `DisplayDocument`. Store metadata (row ids, owner, passcode, plan) lives **outside** the document on the host’s display record.

```ts
type DisplayDocument = {
  schemaVersion: 1;
  name: string;
  views: View[];
  activeViewId: string | null;
  rotation: { enabled: boolean; intervalMs: number };
  themes: ThemeDocument[];
  activeThemeId: string | null;
  colorMode?: 'light' | 'dark';
  settings: {
    stickyNotesEnabled?: boolean;
    voiceEnabled?: boolean;
    holidayEffectsEnabled?: boolean;
    holidayPreviewId?: string;
  };
  alarms?: AlarmDefinition[];
};

type ViewBackground = {
  image?: string;
  imageSize?: 'cover' | 'contain' | 'tile';
  overlayOpacity?: number;
  photos?: Array<{ url: string; caption?: string }>;
  intervalSeconds?: number;
};

type View = {
  id: string;
  name: string;
  icon?: string;
  hidden?: boolean;
  columns: number;
  rowHeight: number;
  widgets: WidgetInstance[];
  background?: ViewBackground;
  notes?: StickyNote[];
};

type WidgetInstance = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
};
```

`ThemeDocument` stays the existing theme JSON Schema (`schemas/theme-document.schema.json`), moved under `@homeslate/schema`. `AlarmDefinition` stays the existing alarm shape.

### Validation

- `validateDisplayDocument(raw)` returns `{ ok: true, document } | { ok: false, errors }`.
- Built-in `type`s have a strict config schema registered next to the widget.
- Unknown `type`s are valid when `id`, `type`, `title`, `layout`, and object `config` are present, so custom widgets round-trip.
- `DisplayStore.put` MUST reject invalid documents. The editor surfaces `errors`.

### Migration

`schemaVersion` is required on v1.

`migrateDisplayDocument(raw)` accepts:

- **v0** — current hosted jsonb (`layouts`, no `schemaVersion`, mixed settings at top level) → v1 (`views`, nested `settings`, `schemaVersion: 1`).
- **v1** — identity.

Hosts run migrate on read so existing Neon rows keep working. Writes after migration persist v1.

### What is not in the document

- `id` / `display_id` (host record)
- `isOwner`, passcode, collaborators
- Plan, entitlements, Stripe customer id
- Google refresh tokens

## Persistence

```ts
type DisplaySummary = {
  id: string;
  name: string;
};

type DisplayRecord = {
  id: string;
  publicId: string; // kiosk polling id (today’s display_id)
  document: DisplayDocument;
};

interface DisplayStore {
  get(id: string): Promise<DisplayRecord | null>;
  getByPublicId(publicId: string): Promise<DisplayRecord | null>;
  put(id: string, document: DisplayDocument): Promise<void>;
  create(document: DisplayDocument): Promise<DisplayRecord>;
  list(): Promise<DisplaySummary[]>;
  remove(id: string): Promise<void>;
}
```

OSS adapters:

- `FileDisplayStore` — one JSON file per display; local-only / no server.
- `SqliteDisplayStore` — default for `apps/reference`.

Hosted adapter: Neon, scoped by account, with entitlement checks inside `create` / `put` (see Hosted Overlay).

Todos and notes remain fields on the document (widget `config` and `view.notes`). A host MAY expose `PATCH` that updates a single widget path and then `put`s the document. That is not a second database and is not required of OSS adapters. The reference app may persist by replacing the whole document.

## Widget Registry

```ts
type WidgetRegistryEntry<TConfig> = {
  type: string;
  name: string;
  description: string;
  icon: ComponentType<{ size?: number | string }>;
  component: ComponentType<WidgetProps<TConfig>>;
  settingsComponent?: ComponentType<WidgetProps<TConfig>>;
  defaultConfig: TConfig;
  defaultLayout: { w: number; h: number; minW?: number; minH?: number; maxW?: number; maxH?: number };
  /** Zod schema used by `@homeslate/schema` to validate `config` for this type. Omit for opaque custom widgets. */
  configSchema?: ZodType;
};

function registerWidget(entry: WidgetRegistryEntry<unknown>): void;
```

Built-ins register themselves inside `@homeslate/widgets` (clock, calendar/iCal, Google calendar variants, photos, Google photo collage, weather, news, stocks, week calendar, todo, sports, alarms, timers). Host apps call `registerWidget` for custom types before mounting editor or display.

A widget that needs Google reads `GoogleRuntime` from context (provided by the host app). Widgets must not import Netlify, Neon, or hosted auth.

## Google Module

`@homeslate/google` is Calendar/Photos access, not “sign in to Homeslate.”

```ts
type GoogleTokens = {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: string; // ISO
};

interface TokenStore {
  getRefreshToken(accountId: string): Promise<string | null>;
  getTokens(accountId: string): Promise<GoogleTokens | null>;
  putTokens(accountId: string, tokens: GoogleTokens): Promise<void>;
  deleteTokens(accountId: string): Promise<void>;
}

interface GoogleBindingStore {
  getAccountIdForDisplay(displayId: string): Promise<string | null>;
  setAccountIdForDisplay(displayId: string, accountId: string): Promise<void>;
}

type GoogleClient = {
  /** Exchanges the code, persists via TokenStore, returns tokens. */
  exchangeAuthCode(accountId: string, code: string, redirectUri: string): Promise<GoogleTokens>;
  getAccessToken(accountId: string): Promise<string>;
  listCalendars(accountId: string): Promise<CalendarListItem[]>;
  listEvents(
    accountId: string,
    params: { calendarIds: string[]; timeMin: string; timeMax: string }
  ): Promise<CalendarEvent[]>;
  /** Server-side fetch of a Google Photos media URL (kiosk/browser cannot use Photos baseUrls). */
  fetchPhoto(accountId: string, params: { baseUrl: string; size: string }): Promise<Uint8Array>;
};

`CalendarEvent` / `CalendarListItem` match the shapes already produced by `display-calendar` (id, title, start, end, allDay, calendarId, color, …). The package re-exports them so editor, display, and hosts share one type.

function createGoogleClient(opts: {
  clientId: string;
  clientSecret: string;
  tokenStore: TokenStore;
}): GoogleClient;
```

Self-hosters set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from their own Google Cloud project. Hosted uses ours.

Kiosk displays have no Google session. The **host** exposes HTTP routes (reference app: small Hono/Express server; hosted: Netlify functions) that resolve `displayId` via `GoogleBindingStore`, then call `listEvents` / `fetchPhoto`. `@homeslate/google` does not import an HTTP framework.

OSS binding is one Google `accountId` per display. The reference app uses `"local"` for that account. Owner+collaborator token pooling and fallback (today’s `display-calendar` candidate list) stay in the private hosted app.

Identity (“who is this Homeslate user”) is hosted-only. Hosted MAY still use Google as the IdP and store calendar tokens on the same user row; that coupling lives in hosted code, not in `@homeslate/google`.

## Hosted Overlay

Private app responsibilities:

- Account identity and session
- Stripe + plans: `free` | `paid`
- Entitlements on the hosted `DisplayStore` only:

```ts
type Entitlements = {
  maxDisplays: number | null;       // null = unlimited
  maxViewsPerDisplay: number | null;
};

type EntitlementErrorCode = 'display_limit' | 'view_limit';
```

`create` fails with `display_limit` when the account is at `maxDisplays`. `put` fails with `view_limit` when `document.views.length` exceeds `maxViewsPerDisplay` (hidden views count). Exact numeric limits are a product decision and are not part of this spec; they are configuration in hosted, not constants in OSS.

- Encrypted `TokenStore`, our GCP OAuth client, multi-tenant Neon
- Optional private extras: invites, collaborators, collaborator token pooling, pairing-as-onboarding, passcodes

`@homeslate/editor` and `@homeslate/display` do not import entitlements. They render the document they are given. The hosted management chrome catches `display_limit` / `view_limit` and shows upgrade UI.

OSS adapters never implement entitlements. Self-host is unlimited.

## Reference App

`apps/reference` wires the packages for the clone-and-run path:

- `SqliteDisplayStore` + `FileTokenStore` + sqlite `GoogleBindingStore` (reference app binds every display to `"local"`)
- Small HTTP server wrapping `@homeslate/google` and document get/put
- Editor + display routes
- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional; without them, Google widgets show the existing empty/reconnect state; iCal calendar still works)
- No accounts, Stripe, or quotas

Local-only without a server remains valid: `FileDisplayStore` + editor + display, Google widgets unused or iCal-only.

## Error Handling

| Case | Behavior |
|---|---|
| Invalid document on `put` | Reject; editor shows validation errors; store unchanged |
| Unknown widget `type` | Document valid; editor/display render a placeholder unless a matching `registerWidget` exists |
| Missing Google tokens on kiosk | Calendar widgets use the existing empty state; no crash |
| `invalid_grant` on refresh | `getAccessToken` throws a typed `GoogleAuthError`; host maps to “Reconnect Google” |
| Missing GCP env vars | `createGoogleClient` throws at startup of the Google-enabled server; reference app still serves editor/display without Google |
| Entitlement failure | Hosted store throws `EntitlementError`; OSS path cannot produce this |

## Testing

- **schema:** golden v0 and v1 fixtures; migrator round-trip; reject invalid built-in widget config; accept unknown `type` with valid instance shape
- **google:** fake `TokenStore`; mock `fetch` to Google token + Calendar endpoints; `invalid_grant` mapping
- **widgets:** keep existing vitest coverage; registry lookup by `type`
- **adapters:** file/sqlite get/put/list against a temp dir
- **reference app:** not required to have full E2E in v1 of the split; smoke that it boots and loads a fixture document

## Extraction Sequence

Do this in the current repo. Do not greenfield-rewrite the app.

1. Lift types + JSON Schema into `packages/schema`. Add `schemaVersion` and `v0 → v1` migrate. Current Vite app imports the package and keeps running.
2. Move token exchange, refresh, and calendar/photos helpers into `packages/google`. Netlify functions become thin wrappers around `createGoogleClient`.
3. Formalize `registerWidget()`. Move built-ins to `packages/widgets`.
4. Split UI into `packages/editor` and `packages/display`. The existing Vite app becomes a host that imports both (still one deployable while hosted lives here).
5. Add `packages/adapters` and `apps/reference`.
6. Move auth, billing, Neon-specific functions, and entitlement checks into `apps/hosted`, then into `homeslate-hosted` (private) **before** this repository is made public.

Until step 6, one private monorepo is the working tree. Public npm (or GitHub Packages) publish of `@homeslate/*` starts when hosted is a separate consumer; until then, workspace `workspace:*` dependencies are enough.

## Out of Scope

- Stripe integration details and free-tier numeric limits
- Widget marketplace / plugin discovery
- Replacing Netlify in hosted
- Making every self-host target (Fly, Docker, systemd) a first-class supported platform beyond the reference app
- AGPL, BSL, or dual-license
- Changing Google Calendar widget UX except as required by the client interface
- Role-aware collaboration redesign (roadmap item; hosted-only if built)

## Success Criteria

- A self-hoster can run `apps/reference` with sqlite, optionally their own GCP OAuth client, and get editor + display + calendar-on-a-wall.
- A tinkerer can persist/validate `DisplayDocument` JSON without using our React packages.
- Hosted continues to serve existing displays after v0 → v1 migrate on read.
- No billing, quota, or Homeslate-account code exists in public packages.
- Hosted adds a new display/view only through entitlement-checked store methods, not through forks of editor/display.
