import type { Handler } from '@netlify/functions';
import type Stripe from 'stripe';
import { getDb } from '../../src/db';
import { getStripe, rawWebhookBody } from '../../src/billing/stripe';
import {
  applySubscriptionToUser,
  resolveSubscriptionUserId,
} from '../../src/billing/syncSubscription';

function subscriptionDataFromStripe(subscription: Stripe.Subscription, customerId: string) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  return {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    subscriptionStatus: subscription.status,
  };
}

async function syncCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!userId || !customerId || !subscriptionId) {
    throw new Error('checkout.session.completed missing linkage fields');
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const db = getDb();
  await applySubscriptionToUser(db, userId, subscriptionDataFromStripe(subscription, customerId));
}

async function syncSubscriptionEvent(
  subscription: Stripe.Subscription,
  options?: { clearSubscription?: boolean }
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const db = getDb();
  const userId = await resolveSubscriptionUserId(db, subscription);

  if (!userId) {
    console.warn('[billing/webhook] no user for subscription', subscription.id);
    return;
  }

  await applySubscriptionToUser(
    db,
    userId,
    subscriptionDataFromStripe(subscription, customerId),
    options
  );
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[billing/webhook] STRIPE_WEBHOOK_SECRET is not set');
    return { statusCode: 500, body: 'Webhook not configured' };
  }

  const signature = event.headers['stripe-signature'] ?? event.headers['Stripe-Signature'];
  const body = rawWebhookBody({ body: event.body ?? null, isBase64Encoded: event.isBase64Encoded });
  if (!signature || !body) {
    return { statusCode: 400, body: 'Missing signature or body' };
  }

  let stripeEvent: Stripe.Event;
  try {
    const stripe = getStripe();
    stripeEvent = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[billing/webhook] signature verification failed:', err);
    return { statusCode: 400, body: 'Invalid signature' };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await syncCheckoutSession(stripeEvent.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await syncSubscriptionEvent(stripeEvent.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await syncSubscriptionEvent(stripeEvent.data.object as Stripe.Subscription, {
          clearSubscription: true,
        });
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('[billing/webhook] handler error:', err);
    return { statusCode: 500, body: 'Webhook handler failed' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
