import { eq } from 'drizzle-orm';
import type { Handler } from '@netlify/functions';
import { getDb, users } from '../../src/db';
import {
  isAllowedPriceId,
  getStripe,
  billingCancelUrl,
  billingSuccessUrl,
  buildCheckoutSessionParams,
} from '../../src/billing/stripe';
import { shouldOpenPortalInsteadOfCheckout } from '../../src/billing/syncSubscription';
import { AUTH_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from './_shared/http';
import { requireGoogleId } from './_shared/googleAuth';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(AUTH_JSON_HEADERS);
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed', AUTH_JSON_HEADERS);
  }

  let googleId: string;
  try {
    googleId = await requireGoogleId(event.headers['authorization']);
  } catch {
    return errorResponse(401, 'Unauthorized', AUTH_JSON_HEADERS);
  }

  try {
    const db = getDb();

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        subscriptionStatus: users.subscriptionStatus,
      })
      .from(users)
      .where(eq(users.googleId, googleId));

    if (!user) {
      return errorResponse(404, 'User not found', AUTH_JSON_HEADERS);
    }

    const origin = event.headers.origin ?? event.headers.Origin;
    const stripe = getStripe();

    if (
      shouldOpenPortalInsteadOfCheckout(
        user.subscriptionStatus,
        user.stripeSubscriptionId,
        user.stripeCustomerId
      )
    ) {
      const customerId = user.stripeCustomerId;
      if (!customerId) {
        return errorResponse(500, 'Missing Stripe customer', AUTH_JSON_HEADERS);
      }
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: billingSuccessUrl(origin),
      });
      if (!portal.url) {
        return errorResponse(500, 'Failed to create portal session', AUTH_JSON_HEADERS);
      }
      return jsonResponse(200, { url: portal.url }, AUTH_JSON_HEADERS);
    }

    let body: { priceId?: string };
    try {
      body = JSON.parse(event.body ?? '{}');
    } catch {
      return errorResponse(400, 'Invalid JSON', AUTH_JSON_HEADERS);
    }

    const priceId = body.priceId?.trim();
    if (!priceId || !isAllowedPriceId(priceId)) {
      return errorResponse(400, 'Invalid price', AUTH_JSON_HEADERS);
    }

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await db.update(users).set({ stripeCustomerId }).where(eq(users.id, user.id));
    }

    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        userId: user.id,
        email: user.email,
        stripeCustomerId,
        priceId,
        successUrl: billingSuccessUrl(origin),
        cancelUrl: billingCancelUrl(origin),
      })
    );

    if (!session.url) {
      return errorResponse(500, 'Failed to create checkout session', AUTH_JSON_HEADERS);
    }

    return jsonResponse(200, { url: session.url }, AUTH_JSON_HEADERS);
  } catch (err) {
    console.error('[billing/checkout] error:', err);
    return errorResponse(500, 'Checkout failed', AUTH_JSON_HEADERS);
  }
};
