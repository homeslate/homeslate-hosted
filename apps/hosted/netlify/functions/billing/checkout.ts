import { eq } from 'drizzle-orm';
import type { Handler } from '@netlify/functions';
import { getDb, users } from '../../../src/db';
import { isAllowedPriceId, getStripe, billingCancelUrl, billingSuccessUrl } from '../../../src/billing/stripe';
import { AUTH_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from '../_shared/http';
import { requireGoogleId } from '../_shared/googleAuth';

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse(AUTH_JSON_HEADERS);
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed', AUTH_JSON_HEADERS);
  }

  try {
    const googleId = await requireGoogleId(event.headers['authorization']);
    const db = getDb();

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(eq(users.googleId, googleId));

    if (!user) {
      return errorResponse(404, 'User not found', AUTH_JSON_HEADERS);
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

    const origin = event.headers.origin ?? event.headers.Origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: billingSuccessUrl(origin),
      cancel_url: billingCancelUrl(origin),
      client_reference_id: user.id,
      metadata: { userId: user.id },
      customer: user.stripeCustomerId ?? undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
    });

    if (!session.url) {
      return errorResponse(500, 'Failed to create checkout session', AUTH_JSON_HEADERS);
    }

    return jsonResponse(200, { url: session.url }, AUTH_JSON_HEADERS);
  } catch (err) {
    console.error('[billing/checkout] error:', err);
    return errorResponse(500, 'Checkout failed', AUTH_JSON_HEADERS);
  }
};
