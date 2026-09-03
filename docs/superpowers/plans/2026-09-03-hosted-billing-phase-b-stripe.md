# Phase B: Stripe Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Stripe Checkout and Customer Portal so users can subscribe to Pro (monthly/annual) and entitlements update automatically via webhooks.

**Architecture:** Add Netlify billing functions (`checkout`, `portal`, `webhook`), a small Stripe helper module, and connect the Phase A UpgradeModal + account menu to live Checkout/Portal URLs. Webhooks sync `users.plan` and Stripe metadata.

**Tech Stack:** Stripe Node SDK, Netlify functions, Drizzle/Neon, React.

**Spec:** `docs/superpowers/specs/2026-09-03-hosted-billing-design.md`

**Prerequisite:** Phase A merged and entitlement enforcement verified.

## Global Constraints
- Use Stripe **Checkout** for subscribe and **Customer Portal** for manage/cancel.
- Two Price IDs via env: `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`.
- Webhook must verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`.
- Link Checkout Session to Neon user via metadata `userId` (internal uuid).
- On active subscription: `plan = 'pro'`; on deleted/canceled: `plan = 'free'`.
- Do not add billing logic to OSS packages.
- Stripe test mode keys until production cutover.

---

### Task 1: Stripe dependency and server helpers

**Files:**
- Modify: root `package.json` (add `stripe` dependency)
- Create: `apps/hosted/src/billing/stripe.ts`
- Create: `apps/hosted/src/billing/stripe.test.ts`

- [ ] **Step 1: Install stripe**

```bash
npm install stripe
```

- [ ] **Step 2: Write test for price validation helper**

```ts
import { describe, expect, it } from 'vitest';
import { isAllowedPriceId } from './stripe';

describe('isAllowedPriceId', () => {
  it('accepts configured monthly and annual ids', () => {
    process.env.STRIPE_PRICE_MONTHLY = 'price_m';
    process.env.STRIPE_PRICE_ANNUAL = 'price_a';
    expect(isAllowedPriceId('price_m')).toBe(true);
    expect(isAllowedPriceId('price_a')).toBe(true);
    expect(isAllowedPriceId('price_other')).toBe(false);
  });
});
```

- [ ] **Step 3: Implement `stripe.ts`**

```ts
import Stripe from 'stripe';

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

export function isAllowedPriceId(priceId: string): boolean {
  const allowed = [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_ANNUAL].filter(Boolean);
  return allowed.includes(priceId);
}
```

Use current Stripe API version from Stripe SDK types at implementation time.

- [ ] **Step 4: Run tests and commit**

```bash
git commit -m "feat: add Stripe server helpers"
```

---

### Task 2: Checkout session endpoint

**Files:**
- Create: `apps/hosted/netlify/functions/billing-checkout.ts`
- Modify: `netlify.toml` (no change needed if `/api/*` redirect covers `billing-checkout` → function name mapping)

**Note:** Netlify function file `billing-checkout.ts` is invoked at `/.netlify/functions/billing-checkout`. Add API route alias if project uses `/api/billing/checkout` pattern — check existing function naming (`displays.ts` → `/api/displays`). Create redirect or name file to match convention.

- [ ] **Step 1: Verify API routing pattern**

Existing: `/api/displays` → `displays.ts`. Create `billing-checkout.ts` and ensure client calls `/api/billing-checkout` OR add `billing/checkout.ts` nested path if supported.

Recommended: `apps/hosted/netlify/functions/billing/checkout.ts` if Netlify supports nested functions; else `billing-checkout.ts` with client path `/api/billing-checkout`.

- [ ] **Step 2: Implement POST handler**

Auth: `requireGoogleId` → load user row (id, email, stripeCustomerId).

Body: `{ priceId: string }` — validate with `isAllowedPriceId`.

Create or reuse Stripe Customer; create Checkout Session:

```ts
mode: 'subscription',
line_items: [{ price: priceId, quantity: 1 }],
success_url: process.env.BILLING_SUCCESS_URL,
cancel_url: process.env.BILLING_CANCEL_URL,
client_reference_id: user.id,
metadata: { userId: user.id },
customer: user.stripeCustomerId ?? undefined,
customer_email: user.stripeCustomerId ? undefined : user.email,
```

Return `{ url: session.url }`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add Stripe Checkout session endpoint"
```

---

### Task 3: Customer Portal endpoint

**Files:**
- Create: `apps/hosted/netlify/functions/billing-portal.ts`

- [ ] **Step 1: Implement POST handler**

Auth required. User must have `stripe_customer_id`; if missing return 400 "No subscription".

```ts
const session = await stripe.billingPortal.sessions.create({
  customer: user.stripeCustomerId,
  return_url: process.env.BILLING_SUCCESS_URL ?? origin,
});
return { url: session.url };
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add Stripe Customer Portal endpoint"
```

---

### Task 4: Webhook handler and subscription sync

**Files:**
- Create: `apps/hosted/netlify/functions/billing-webhook.ts`
- Create: `apps/hosted/src/billing/syncSubscription.ts`
- Create: `apps/hosted/src/billing/syncSubscription.test.ts`

- [ ] **Step 1: Write sync tests**

```ts
import { describe, expect, it } from 'vitest';
import { planFromSubscriptionStatus } from './syncSubscription';

describe('planFromSubscriptionStatus', () => {
  it('active → pro', () => {
    expect(planFromSubscriptionStatus('active')).toBe('pro');
  });
  it('canceled → free', () => {
    expect(planFromSubscriptionStatus('canceled')).toBe('free');
  });
});
```

- [ ] **Step 2: Implement syncSubscription.ts**

```ts
export function planFromSubscriptionStatus(status: string | null | undefined): 'free' | 'pro' {
  if (status === 'active' || status === 'trialing') return 'pro';
  return 'free';
}

export async function applySubscriptionToUser(db, userId: string, data: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  subscriptionStatus: string;
}): Promise<void> {
  const plan = planFromSubscriptionStatus(data.subscriptionStatus);
  await db.update(users).set({ ...data, plan }).where(eq(users.id, userId));
}
```

- [ ] **Step 3: Implement webhook handler**

- Disable default body parsing (Netlify: use raw body for signature — check Netlify Stripe webhook pattern)
- `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`
- Handle `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Resolve `userId` from metadata / client_reference_id

- [ ] **Step 4: Run tests and commit**

```bash
git commit -m "feat: add Stripe webhook and subscription sync"
```

---

### Task 5: Wire UpgradeModal and account menu

**Files:**
- Modify: `apps/hosted/src/components/UpgradeModal.tsx`
- Modify: `apps/hosted/src/pages/DisplayListPage.tsx` (or shared hook `useUpgrade`)
- Modify: `apps/hosted/src/components/ManagementLayout.tsx` (Manage subscription link)

- [ ] **Step 1: Enable billing flag**

Set `VITE_BILLING_ENABLED=true` in env example / Netlify build env.

- [ ] **Step 2: UpgradeModal — monthly/annual choice**

Radio or two buttons → `POST /api/billing-checkout` with selected `priceId` → `window.location.href = url`.

- [ ] **Step 3: Account menu**

If user has `stripe_customer_id` (expose via `GET /api/me` plan fields), show "Manage subscription" → Portal endpoint.

- [ ] **Step 4: Extend GET /api/me**

Return `{ plan, subscriptionStatus }` for UI badges (optional "Pro" badge).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: connect upgrade UI to Stripe Checkout and Portal"
```

---

### Task 6: Stripe Dashboard setup and deploy validation

**Files:**
- Create: `docs/superpowers/specs/2026-09-03-hosted-billing-stripe-setup.md` (operator checklist, optional)

- [ ] **Step 1: Document Stripe Dashboard steps**

1. Create Product "Homeslate Pro"
2. Create monthly + annual Prices
3. Copy Price IDs to Netlify env
4. Create webhook endpoint → `https://<site>/.netlify/functions/billing-webhook`
5. Enable events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
6. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

- [ ] **Step 2: Local webhook test**

```bash
stripe listen --forward-to localhost:8888/.netlify/functions/billing-webhook
```

Complete test Checkout → verify user `plan = 'pro'` in Neon.

- [ ] **Step 3: Deploy preview**

Verify Checkout + Portal on Netlify deploy preview with test keys.

- [ ] **Step 4: Checkpoint**

Phase B complete when test-mode subscribe/cancel round-trip updates entitlements in production deploy.

---

## Self-Review

1. Spec coverage: Checkout, Portal, webhook, env vars, UI wiring — covered.
2. Webhook raw body called out — implementer must verify Netlify config.
3. API routing naming aligned with existing `/api/*` pattern in Task 2 step 1.
