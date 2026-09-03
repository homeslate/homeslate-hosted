# Stripe Billing Setup (Phase B)

Operator checklist for Homeslate hosted billing in **test mode** before production cutover.

## 1. Stripe Dashboard

1. Create product **Homeslate Pro**
2. Add recurring prices:
   - Monthly (copy Price ID → `STRIPE_PRICE_MONTHLY`)
   - Annual (copy Price ID → `STRIPE_PRICE_ANNUAL`)
3. Developers → API keys:
   - Secret key → `STRIPE_SECRET_KEY`

## 2. Netlify environment variables

| Variable | Scope | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Functions | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Functions | From webhook endpoint (step 3) |
| `STRIPE_PRICE_MONTHLY` | Functions | `price_...` |
| `STRIPE_PRICE_ANNUAL` | Functions | `price_...` |
| `BILLING_SUCCESS_URL` | Functions | e.g. `https://homeslate.dev/displays?upgraded=1` |
| `BILLING_CANCEL_URL` | Functions | e.g. `https://homeslate.dev/displays` |
| `VITE_BILLING_ENABLED` | Build | `true` |
| `VITE_STRIPE_PRICE_MONTHLY` | Build | Same monthly price ID |
| `VITE_STRIPE_PRICE_ANNUAL` | Build | Same annual price ID |

## 3. Webhook endpoint

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://<your-site>/api/billing/webhook` (or `https://<your-site>/.netlify/functions/billing-webhook`)
3. Events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

## 4. Local webhook testing

```bash
stripe listen --forward-to localhost:8888/.netlify/functions/billing-webhook
```

Use the CLI webhook secret in `.env.local` as `STRIPE_WEBHOOK_SECRET`.

## 5. Database

Apply migrations locally:

```bash
npm run db:migrate
```

**Production:** run before or immediately after deploying billing code:

```bash
npm run db:migrate:prod
```

Requires `DATABASE_URL_PROD` in `.env.local`. Without migration `0003`, sign-in fails with 401 because `exchange-code` reads billing columns on `users`.

## 7. Deploy after env changes

Netlify applies function env vars on the next deploy. **`VITE_*` variables are build-time only** — trigger **Deploy site** after setting them so the Upgrade modal enables Checkout.

Verify billing functions respond (not 404):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://homeslate.dev/api/billing/webhook \
  -H "Content-Type: application/json" -d '{}'
```

Expect `400` (missing signature) or `500` (secret not loaded yet) — **not** `404`.

## 6. Smoke test

1. Sign in as free user → hit display/view limit → Upgrade → Stripe Checkout (test card `4242…`)
2. After redirect, confirm `users.plan = 'pro'` in Neon
3. Profile menu → **Manage subscription** → cancel in Portal
4. Confirm webhook sets `plan = 'free'`
