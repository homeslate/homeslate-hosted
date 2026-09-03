import { eq } from 'drizzle-orm';
import type { Handler } from '@netlify/functions';
import { getDb, users } from '../../../src/db';
import { getStripe, billingSuccessUrl } from '../../../src/billing/stripe';
import { AUTH_JSON_HEADERS, errorResponse, jsonResponse, optionsResponse } from '../_shared/http';
import { requireGoogleId } from '../_shared/googleAuth';

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
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(eq(users.googleId, googleId));

    if (!user) {
      return errorResponse(404, 'User not found', AUTH_JSON_HEADERS);
    }

    if (!user.stripeCustomerId) {
      return errorResponse(400, 'No subscription', AUTH_JSON_HEADERS);
    }

    const origin = event.headers.origin ?? event.headers.Origin;
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: billingSuccessUrl(origin),
    });

    if (!session.url) {
      return errorResponse(500, 'Failed to create portal session', AUTH_JSON_HEADERS);
    }

    return jsonResponse(200, { url: session.url }, AUTH_JSON_HEADERS);
  } catch (err) {
    console.error('[billing/portal] error:', err);
    return errorResponse(500, 'Portal failed', AUTH_JSON_HEADERS);
  }
};
