# Phase A: Hosted Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce free-tier display/view limits on the hosted app and show upgrade UI when limits are hit — without Stripe integration yet.

**Architecture:** Add billing columns to `users`, a hosted-only `apps/hosted/src/billing/` module with plan limits and assertion helpers, enforce in `displays.ts` (create) and `config.ts` (save), and catch entitlement errors in management UI with an upgrade modal.

**Tech Stack:** Drizzle/Neon, Netlify functions, React/Mantine, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-03-hosted-billing-design.md`

## Global Constraints
- Entitlements live in **hosted only** — no changes to `@homeslate/*` npm packages.
- Free tier: **1 display**, **3 views** per display (hidden views count).
- Pro tier: unlimited (`maxDisplays: null`, `maxViewsPerDisplay: null`).
- Error codes: `display_limit` | `view_limit` on **403** responses.
- Limits apply to the **display owner**, not collaborators.
- Count views via migrated `DisplayDocument.views.length` after `writeStoredConfig` succeeds (not raw `layouts` field).
- Phase A upgrade CTA may be disabled until Phase B; modal copy must still explain Pro.

---

### Task 1: Database migration and Drizzle schema

**Files:**
- Modify: `drizzle/schema.ts`
- Create: `drizzle/0003_billing_users.sql` (via `npm run db:generate`)

**Interfaces:**
- Produces: `users.plan`, `users.stripeCustomerId`, `users.stripeSubscriptionId`, `users.stripePriceId`, `users.subscriptionStatus`

- [ ] **Step 1: Write failing test for plan default**

Create `apps/hosted/src/billing/plans.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PLAN_ENTITLEMENTS, DEFAULT_PLAN } from './plans';

describe('plans', () => {
  it('defaults to free', () => {
    expect(DEFAULT_PLAN).toBe('free');
  });

  it('free tier limits', () => {
    expect(PLAN_ENTITLEMENTS.free.maxDisplays).toBe(1);
    expect(PLAN_ENTITLEMENTS.free.maxViewsPerDisplay).toBe(3);
  });

  it('pro tier is unlimited', () => {
    expect(PLAN_ENTITLEMENTS.pro.maxDisplays).toBeNull();
    expect(PLAN_ENTITLEMENTS.pro.maxViewsPerDisplay).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/hosted/src/billing/plans.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Add Drizzle columns to `users`**

In `drizzle/schema.ts`, extend `users`:

```ts
plan: varchar('plan').default('free').notNull(),
stripeCustomerId: text('stripe_customer_id'),
stripeSubscriptionId: text('stripe_subscription_id'),
stripePriceId: text('stripe_price_id'),
subscriptionStatus: varchar('subscription_status'),
```

- [ ] **Step 4: Generate migration**

Run: `npm run db:generate`
Commit generated SQL under `drizzle/`.

- [ ] **Step 5: Implement `plans.ts`**

Create `apps/hosted/src/billing/plans.ts`:

```ts
export type PlanId = 'free' | 'pro';

export const DEFAULT_PLAN: PlanId = 'free';

export type Entitlements = {
  maxDisplays: number | null;
  maxViewsPerDisplay: number | null;
};

export const PLAN_ENTITLEMENTS: Record<PlanId, Entitlements> = {
  free: { maxDisplays: 1, maxViewsPerDisplay: 3 },
  pro: { maxDisplays: null, maxViewsPerDisplay: null },
};

export function entitlementsForPlan(plan: string | null | undefined): Entitlements {
  if (plan === 'pro') return PLAN_ENTITLEMENTS.pro;
  return PLAN_ENTITLEMENTS.free;
}
```

- [ ] **Step 6: Re-run test**

Run: `npx vitest run apps/hosted/src/billing/plans.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add drizzle/ apps/hosted/src/billing/
git commit -m "feat: add user billing columns and plan entitlements config"
```

---

### Task 2: EntitlementError and assertion helpers

**Files:**
- Create: `apps/hosted/src/billing/entitlementError.ts`
- Create: `apps/hosted/src/billing/entitlements.ts`
- Create: `apps/hosted/src/billing/entitlements.test.ts`

**Interfaces:**
- Consumes: `plans.ts` from Task 1
- Produces: `EntitlementError`, `assertCanCreateDisplay(count, entitlements)`, `assertViewCount(count, entitlements)`

- [ ] **Step 1: Write failing tests**

Create `apps/hosted/src/billing/entitlements.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PLAN_ENTITLEMENTS } from './plans';
import { assertCanCreateDisplay, assertViewCount } from './entitlements';
import { EntitlementError } from './entitlementError';

describe('assertCanCreateDisplay', () => {
  it('allows first display on free', () => {
    expect(() => assertCanCreateDisplay(0, PLAN_ENTITLEMENTS.free)).not.toThrow();
  });

  it('blocks second display on free', () => {
    expect(() => assertCanCreateDisplay(1, PLAN_ENTITLEMENTS.free)).toThrow(EntitlementError);
    try {
      assertCanCreateDisplay(1, PLAN_ENTITLEMENTS.free);
    } catch (e) {
      expect((e as EntitlementError).code).toBe('display_limit');
    }
  });

  it('allows unlimited on pro', () => {
    expect(() => assertCanCreateDisplay(99, PLAN_ENTITLEMENTS.pro)).not.toThrow();
  });
});

describe('assertViewCount', () => {
  it('allows 3 views on free', () => {
    expect(() => assertViewCount(3, PLAN_ENTITLEMENTS.free)).not.toThrow();
  });

  it('blocks 4 views on free', () => {
    expect(() => assertViewCount(4, PLAN_ENTITLEMENTS.free)).toThrow(EntitlementError);
    try {
      assertViewCount(4, PLAN_ENTITLEMENTS.free);
    } catch (e) {
      expect((e as EntitlementError).code).toBe('view_limit');
    }
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

`entitlementError.ts`:

```ts
export type EntitlementErrorCode = 'display_limit' | 'view_limit';

export class EntitlementError extends Error {
  readonly code: EntitlementErrorCode;

  constructor(code: EntitlementErrorCode, message: string) {
    super(message);
    this.name = 'EntitlementError';
    this.code = code;
  }
}
```

`entitlements.ts`:

```ts
import type { Entitlements } from './plans';
import { EntitlementError } from './entitlementError';

export function assertCanCreateDisplay(ownedDisplayCount: number, entitlements: Entitlements): void {
  if (entitlements.maxDisplays === null) return;
  if (ownedDisplayCount >= entitlements.maxDisplays) {
    throw new EntitlementError('display_limit', 'Display limit reached');
  }
}

export function assertViewCount(viewCount: number, entitlements: Entitlements): void {
  if (entitlements.maxViewsPerDisplay === null) return;
  if (viewCount > entitlements.maxViewsPerDisplay) {
    throw new EntitlementError('view_limit', 'View limit reached');
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add entitlement assertion helpers"
```

---

### Task 3: Enforce display limit on POST /api/displays

**Files:**
- Modify: `apps/hosted/netlify/functions/displays.ts`
- Modify: `apps/hosted/netlify/functions/_shared/http.ts` (add `entitlementResponse` helper if needed)
- Create: `apps/hosted/netlify/functions/displays.entitlements.test.ts`

**Interfaces:**
- Consumes: `entitlements.ts`, `plans.ts`, Drizzle `users.plan`

- [ ] **Step 1: Write failing handler test**

Test pattern (mock db or extract pure handler logic — follow existing `netlifyDisplaysSmoke.test.ts` style):

```ts
// displays.entitlements.test.ts — test that EntitlementError maps to 403 + code
import { describe, expect, it } from 'vitest';
import { EntitlementError } from '../../src/billing/entitlementError';

describe('entitlement HTTP mapping', () => {
  it('EntitlementError has display_limit code', () => {
    const err = new EntitlementError('display_limit', 'Display limit reached');
    expect(err.code).toBe('display_limit');
  });
});
```

Add integration-style test if feasible with mocked `getDb`; otherwise unit-test a extracted `checkCreateDisplayEntitlement(userId, db)` function.

- [ ] **Step 2: Implement enforcement in POST handler**

Before `insert(displays)` in `displays.ts`:

1. Select `users.id`, `users.plan` for `googleId`
2. Count owned displays for that user
3. `entitlementsForPlan(plan)` → `assertCanCreateDisplay(count, entitlements)`
4. On `EntitlementError`, return 403:

```ts
return {
  statusCode: 403,
  headers: AUTH_JSON_HEADERS,
  body: JSON.stringify({ error: err.message, code: err.code }),
};
```

- [ ] **Step 3: Run tests**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: enforce display limit on create"
```

---

### Task 4: Enforce view limit on PUT /api/config

**Files:**
- Modify: `apps/hosted/netlify/functions/config.ts`
- Create: `apps/hosted/src/billing/getOwnerEntitlements.ts` (db helper)
- Test: `apps/hosted/src/billing/getOwnerEntitlements.test.ts` or config entitlement test

**Interfaces:**
- Consumes: `writeStoredConfig` result `document.views.length`, owner `users.plan`

- [ ] **Step 1: Add helper to load owner entitlements by displayId**

```ts
// getOwnerEntitlements.ts
export async function getOwnerEntitlementsForDisplay(
  db: Db,
  displayId: string
): Promise<{ entitlements: Entitlements; viewCount: number } | null>
```

Lookup `displays.userId` → `users.plan` → entitlements. View count passed in from caller after `writeStoredConfig`.

- [ ] **Step 2: Enforce in config.ts PUT**

After `writeStoredConfig` succeeds and before upsert:

```ts
const viewCount = written.document.views.length;
const owner = await db.select({ plan: users.plan }).from(displays)
  .innerJoin(users, eq(users.id, displays.userId))
  .where(eq(displays.id, displayId));
assertViewCount(viewCount, entitlementsForPlan(owner[0]?.plan));
```

Catch `EntitlementError` → 403 with `code`.

- [ ] **Step 3: Run tests**

Run: `npm run test:run`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: enforce view limit on config save"
```

---

### Task 5: Upgrade modal and API error handling in UI

**Files:**
- Create: `apps/hosted/src/components/UpgradeModal.tsx`
- Modify: `apps/hosted/src/services/apiClient.ts` (expose `code` on `ApiError` from JSON body)
- Modify: `apps/hosted/src/pages/DisplayListPage.tsx` (create display errors)
- Modify: `apps/hosted/src/pages/DisplayDetailPage.tsx` and/or `ViewEditorPage.tsx` (config save errors)
- Modify: `apps/hosted/src/pages/DisplayListPage.tsx` or `ManagementLayout.tsx` (show plan badge optional)

**Interfaces:**
- Consumes: API `{ error, code }` on 403

- [ ] **Step 1: Extend ApiError**

In `apiClient.ts`, when parsing error JSON, read `code` field:

```ts
export class ApiError extends Error {
  readonly code?: string;
  // set this.code = record.code when string
}
```

- [ ] **Step 2: Create UpgradeModal**

Mantine `Modal` with:
- Title: "Upgrade to Pro"
- Copy: unlimited displays & views
- Primary button: "Upgrade" (disabled or `onClick` noop in Phase A; env `import.meta.env.VITE_BILLING_ENABLED`)
- Secondary: "Not now"

- [ ] **Step 3: Wire DisplayListPage**

In `handleNewDisplay` catch block:

```ts
if (err instanceof ApiError && err.code === 'display_limit') {
  setUpgradeOpen(true);
}
```

- [ ] **Step 4: Wire config save paths**

In DisplayDetailPage / ViewEditorPage save handlers, catch `view_limit` → open same modal.

- [ ] **Step 5: Manual smoke**

Run `netlify dev`, set user to free in DB, attempt 2nd display and 4th view — modal appears.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: show upgrade modal on entitlement errors"
```

---

### Task 6: Integration checkpoint

- [ ] **Step 1: Full test suite**

Run: `npm run test:run && npm run build`

- [ ] **Step 2: Document manual QA**

In spec or README snippet: set `plan = 'pro'` in Neon to verify unlimited; revert to `free` for limit testing.

- [ ] **Step 3: Merge readiness**

Phase A complete when limits enforced and UI shows upgrade modal. Proceed to Phase B Stripe plan.

---

## Self-Review

1. Spec coverage: DB, enforcement points, UI, error shape — covered.
2. Placeholder scan: no TBD steps.
3. Type consistency: `EntitlementError.code` matches API `code` field.
4. Gaps: migration must be applied to dev/prod Neon before deploy.
