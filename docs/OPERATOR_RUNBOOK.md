# Operator runbook

Day-to-day support for **homeslate.dev** without a custom admin UI. Use Neon and Stripe for most work; use the CLI scripts below for repeatable, safer changes.

## Prerequisites

In `.env.local` (never commit):

| Variable | Used for |
|---|---|
| `DATABASE_URL_PROD` | All ops scripts (Neon **main** branch) |
| `STRIPE_SECRET_KEY` | Billing scripts — use **test** or **live** intentionally |

Scripts always prefer `DATABASE_URL_PROD` over `DATABASE_URL` so you don't accidentally hit dev.

## Quick reference: which tool when

| Task | Tool |
|---|---|
| Look up a user | `npm run ops:lookup-user -- email@example.com` |
| Fix plan drift after Stripe change | `npm run ops:sync-stripe-user -- email@example.com --confirm` |
| Grant free Pro (beta / comp) | `npm run ops:grant-pro-comp -- email@example.com --confirm` |
| Revoke comp Pro | `npm run ops:revoke-pro-comp -- email@example.com --confirm` |
| Browse tables visually | `npm run ops:db:studio:prod` |
| Subscriptions, refunds, invoices | [Stripe Dashboard](https://dashboard.stripe.com) |
| Raw SQL / ad-hoc queries | [Neon Console](https://console.neon.tech) → SQL Editor |
| Production errors | [Sentry](https://sentry.io) |
| Apply schema migrations | `npm run db:migrate:prod` |

## CLI scripts

All write operations require **`--confirm`** after reviewing the dry-run output.

### Lookup user (read-only)

```bash
npm run ops:lookup-user -- support@example.com
```

Prints the `users` row (plan, Stripe IDs, subscription status) and owned displays.

### Sync user from Stripe

Re-reads Stripe and updates the DB using the same logic as billing webhooks.

```bash
# Preview only — shows current DB + Stripe subscription, no writes
npm run ops:sync-stripe-user -- support@example.com

# Apply changes
npm run ops:sync-stripe-user -- support@example.com --confirm
```

Use when:

- Webhook missed or failed (check Stripe → Developers → Webhooks → event log)
- User paid but `plan` is still `free` in Neon
- You canceled in Stripe Dashboard and DB still shows `pro`

**Stripe is the source of truth** for paid subscriptions. Prefer this over hand-editing `users.plan`.

### Grant comp Pro (no Stripe subscription)

For beta testers, friends & family, or support comps — **not** for paying customers.

```bash
npm run ops:grant-pro-comp -- beta@example.com --confirm
```

Safeguards:

- Refuses if DB or Stripe shows an active subscription
- Sets `plan = 'pro'` only; does not create Stripe charges
- Leaves existing Stripe customer IDs unchanged for audit

### Revoke comp Pro

```bash
npm run ops:revoke-pro-comp -- beta@example.com --confirm
```

Sets `plan = 'free'`. Refuses if Stripe still has an active subscription (cancel there first).

### Drizzle Studio (prod)

```bash
npm run ops:db:studio:prod
```

Visual browser for `users`, `displays`, `display_configs`, etc. **Read-mostly** — direct edits bypass app validation and webhooks.

## Common scenarios

### “User upgraded but still on Free”

1. `npm run ops:lookup-user -- email@example.com`
2. Stripe Dashboard → Customers → find by email → confirm subscription is **active**
3. Stripe → Webhooks → check recent `checkout.session.completed` delivery
4. `npm run ops:sync-stripe-user -- email@example.com --confirm`
5. User refreshes or signs out/in — `/api/me` returns updated `plan`

### “User canceled but still shows Pro”

1. Stripe → confirm subscription status (`canceled` or `active` until period end)
2. `npm run ops:sync-stripe-user -- email@example.com --confirm`
3. Portal cancel-at-period-end keeps `pro` until the period ends — that's expected

### “Grant beta access without billing”

```bash
npm run ops:grant-pro-comp -- beta@example.com --confirm
```

Tell the user to refresh. No Stripe setup needed.

### “User wants account deleted”

They can delete from the profile menu (avatar → Delete account). That removes the DB user, cancels Stripe, and deletes the Stripe customer.

For manual deletion (support escalation):

```sql
-- Neon SQL — cascades displays, configs, collaborators
DELETE FROM users WHERE lower(email) = lower('email@example.com');
```

Cancel Stripe separately first if comp Pro without auto-delete.

### “Sign-in returns 401 after deploy”

Usually missing billing columns on prod. Run:

```bash
npm run db:migrate:prod
```

See [Stripe billing setup](./superpowers/specs/2026-09-03-hosted-billing-stripe-setup.md).

## Useful Neon SQL snippets

**Recent sign-ups**

```sql
SELECT email, plan, subscription_status, created_at
FROM users
ORDER BY created_at DESC
LIMIT 20;
```

**User with displays**

```sql
SELECT u.email, u.plan, d.name, d.display_id, d.created_at
FROM users u
LEFT JOIN displays d ON d.user_id = u.id
WHERE lower(u.email) = lower('email@example.com');
```

**Count free vs pro**

```sql
SELECT plan, count(*) FROM users GROUP BY plan;
```

**View count in config JSON** (approximate — configs are JSON documents)

```sql
SELECT d.name,
       jsonb_array_length(c.config->'views') AS view_count
FROM displays d
JOIN display_configs c ON c.display_id = d.id
JOIN users u ON u.id = d.user_id
WHERE lower(u.email) = lower('email@example.com');
```

## Safety rules

1. **Never commit** `.env.local` or paste prod connection strings into chat/logs
2. **Writes need `--confirm`** on ops scripts — read the preview first
3. **Billing truth = Stripe** — sync with `ops:sync-stripe-user`, don't hand-edit `stripe_*` columns
4. **Comp Pro ≠ paid Pro** — use `grant-pro-comp`; paid users go through Checkout
5. **Test vs live Stripe keys** — double-check which `STRIPE_SECRET_KEY` is in `.env.local` before syncing

## Related docs

- [Stripe billing setup](./superpowers/specs/2026-09-03-hosted-billing-stripe-setup.md) — env vars, webhooks, smoke test
- [README](../README.md) — deploy checklist, Netlify env vars
