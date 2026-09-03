# Hosted Billing & Entitlements Design

## Status
Approved. Ready for implementation.

## Goal
Add subscription billing (Stripe) and plan-based entitlements to the private **homeslate-hosted** app. Free users get limited displays/views; Pro subscribers get unlimited. OSS packages remain unaware of billing.

## Prerequisites
- Phase 6 complete: hosted app in `homeslate-hosted`, consumes `@homeslate/*` from npm.
- Google OAuth identity and Neon persistence already exist.

## Product decisions

| Topic | Choice |
|---|---|
| Plans (v1) | `free` and `pro` |
| Free tier | **1 display**, **3 views** per display (hidden views count) |
| Pro tier | Unlimited displays and views |
| Billing model | Single Pro subscription with **monthly + annual** Stripe Prices |
| Upgrade | Stripe Checkout; manage/cancel via Stripe Customer Portal |
| Phasing | **Phase A:** entitlements + upgrade UI → **Phase B:** Stripe wiring |
| Multi-tier later | Store `stripe_price_id` on user; map price → plan via config |

## Non-goals (v1)
- Seat-based / collaborator billing
- Trials, coupons, tax configuration UI
- Entitlements in `@homeslate/*` packages
- Renaming hosted `layouts` → `views` in UI state (count views via migrated document at save time)
- Usage metering beyond display/view counts

## Architecture

### Hosted-only billing module

Location: `apps/hosted/src/billing/`

```
billing/
  entitlements.ts      # plan → limits, getEntitlements(userId)
  entitlementError.ts  # EntitlementError + codes
  plans.ts             # PLAN_ENTITLEMENTS constants
  stripe.ts            # Phase B: Stripe client helpers
  syncSubscription.ts  # Phase B: map Stripe events → user row
```

No billing code in OSS repos or npm packages.

### Database (`users` table)

Add columns (Drizzle migration):

| Column | Type | Notes |
|---|---|---|
| `plan` | `varchar` | `'free' \| 'pro'`, default `'free'` |
| `stripe_customer_id` | `text` | nullable |
| `stripe_subscription_id` | `text` | nullable |
| `stripe_price_id` | `text` | nullable; enables future tiers |
| `subscription_status` | `varchar` | nullable: `active`, `canceled`, `past_due`, `trialing`, etc. |

Existing users default to `free`.

### Entitlements

```ts
type Entitlements = {
  maxDisplays: number | null;       // null = unlimited
  maxViewsPerDisplay: number | null;
};

type EntitlementErrorCode = 'display_limit' | 'view_limit';
```

Plan config (single source of truth in `plans.ts`):

```ts
export const PLAN_ENTITLEMENTS = {
  free: { maxDisplays: 1, maxViewsPerDisplay: 3 },
  pro: { maxDisplays: null, maxViewsPerDisplay: null },
} as const;
```

`getEntitlements(userId)` reads `users.plan` and returns limits.

### Enforcement points

Entitlements apply to the **display owner's** account, not collaborators.

| Endpoint | Check | Code |
|---|---|---|
| `POST /api/displays` | Count displays where `displays.user_id = user.id` | `display_limit` |
| `PUT /api/config?displayId=` | After `writeStoredConfig` succeeds, count `document.views.length` on the display **owner** | `view_limit` |

Return **403** with body:

```json
{ "error": "Display limit reached", "code": "display_limit" }
```

Collaborators may edit configs but cannot bypass the owner's view limit.

### UI (hosted chrome)

- Catch API errors with `code: 'display_limit' | 'view_limit'`
- Show **UpgradeModal** with Pro benefits and CTA
- **Phase A:** CTA disabled or shows "Coming soon" unless `VITE_BILLING_ENABLED=true`
- **Phase B:** CTA opens Checkout (monthly/annual choice); account menu adds "Manage subscription" → Portal

`@homeslate/editor` and `@homeslate/display` do not import billing code.

## Phase B: Stripe

### Netlify functions

| Route | Purpose |
|---|---|
| `POST /api/billing/checkout` | Create Checkout Session (`priceId` body param) |
| `POST /api/billing/portal` | Create Customer Portal session |
| `POST /api/billing/webhook` | Stripe webhooks (raw body, signature verify) |

Register in `netlify.toml` redirects (same pattern as other `/api/*` routes).

### Webhook events

| Event | Action |
|---|---|
| `checkout.session.completed` | Link customer + subscription; set `plan = 'pro'` |
| `customer.subscription.updated` | Sync `subscription_status`, `stripe_price_id`; set plan active/canceled |
| `customer.subscription.deleted` | Set `plan = 'free'`, clear subscription fields |

Use `client_reference_id` or metadata `userId` on Checkout Session to link Stripe customer to Neon user.

### Environment variables

| Variable | Where |
|---|---|
| `STRIPE_SECRET_KEY` | Netlify (server) |
| `STRIPE_WEBHOOK_SECRET` | Netlify (webhook function) |
| `STRIPE_PRICE_MONTHLY` | Netlify |
| `STRIPE_PRICE_ANNUAL` | Netlify |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Build-time (client Checkout redirect only if needed) |
| `BILLING_SUCCESS_URL` | Netlify (Checkout success redirect, e.g. `/displays?upgraded=1`) |
| `BILLING_CANCEL_URL` | Netlify (Checkout cancel redirect) |

Products and Prices are created in Stripe Dashboard; IDs passed via env.

### Extensibility (multi-tier)

Replace hardcoded `free | pro` plan derivation with:

```ts
const PRICE_TO_PLAN: Record<string, PlanId> = {
  [process.env.STRIPE_PRICE_MONTHLY!]: 'pro',
  [process.env.STRIPE_PRICE_ANNUAL!]: 'pro',
  // future tiers: add price IDs here
};
```

## Error handling

| Case | Behavior |
|---|---|
| Free user at display cap | 403 `display_limit`; UI shows upgrade modal |
| Free user adding 4th view | 403 `view_limit`; UI shows upgrade modal |
| Stripe webhook signature invalid | 400; log; no DB change |
| Checkout without auth | 401 |
| User already Pro | Checkout still allowed (Portal preferred for changes) |

## Testing

### Phase A
- Unit tests: `getEntitlements`, `assertCanCreateDisplay`, `assertViewCount` (pure functions)
- Handler tests: `displays.ts` POST returns 403 at limit; `config.ts` PUT returns 403 when views exceed cap
- Existing suite must stay green

### Phase B
- Unit tests: webhook payload → user row updates (mock Stripe events)
- Manual: Stripe CLI `stripe listen --forward-to localhost:8888/.netlify/functions/billing-webhook`

## Implementation plans

- Phase A: `docs/superpowers/plans/2026-09-03-hosted-billing-phase-a-entitlements.md`
- Phase B: `docs/superpowers/plans/2026-09-03-hosted-billing-phase-b-stripe.md`

## Success criteria

### Phase A
- Free users cannot create a 2nd display or save a 4th view
- Pro users (manually set `plan = 'pro'` in DB for testing) are unlimited
- Upgrade modal appears on limit errors

### Phase B
- Checkout upgrades user to Pro; entitlements unlock immediately after webhook
- Portal allows cancel; webhook downgrades to free
- Production deploy with Stripe test mode validated before live keys
