import type { Handler } from '@netlify/functions';
import type Stripe from 'stripe';
import { getDb } from '../../../src/db';
import { getStripe } from '../../../src/billing/stripe';
import {
  applySubscriptionToUser,
  findUserIdByStripeCustomerId,
  findUserIdByStripeSubscriptionId,
} from '../../../src/billing/syncSubscription';

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
    console.warn('[billing/webhook] checkout.session.completed missing linkage fields', {
      userId,
      customerId,
      subscriptionId,
    });
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const db = getDb();
  await applySubscriptionToUser(db, userId, subscriptionDataFromStripe(subscription, customerId));
}

async function syncSubscriptionEvent(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const db = getDb();
  let userId = await findUserIdByStripeSubscriptionId(db, subscription.id);
  if (!userId) {
    userId = await findUserIdByStripeCustomerId(db, customerId);
  }

  if (!userId) {
    console.warn('[billing/webhook] no user for subscription', subscription.id);
    return;
  }

  await applySubscriptionToUser(db, userId, subscriptionDataFromStripe(subscription, customerId));
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
  if (!signature || !event.body) {
    return { statusCode: 400, body: 'Missing signature or body' };
  }

  let stripeEvent: Stripe.Event;
  try {
    const stripe = getStripe();
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
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
      case 'customer.subscription.deleted':
        await syncSubscriptionEvent(stripeEvent.data.object as Stripe.Subscription);
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
