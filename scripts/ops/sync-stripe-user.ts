#!/usr/bin/env node
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { requireConfirmFlag, requireStripeSecretKey, usage } from './_env.ts';
import { findUserByEmail, getDb, users } from './_db.ts';
import {
  applySubscriptionToUser,
} from '../../apps/hosted/src/billing/syncSubscription.ts';

const email = process.argv[2];
if (!email || email.startsWith('-')) {
  usage('Usage: npm run ops:sync-stripe-user -- <email> [--confirm]');
}

const db = getDb();
const user = await findUserByEmail(db, email);

if (!user) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}

console.log('Current DB row');
console.log(JSON.stringify(user, null, 2));

if (!user.stripeCustomerId) {
  console.error('\nNo stripe_customer_id on user. They have not completed Checkout yet.');
  process.exit(1);
}

const stripe = new Stripe(requireStripeSecretKey());
const subscriptions = await stripe.subscriptions.list({
  customer: user.stripeCustomerId,
  status: 'all',
  limit: 20,
});

const active = subscriptions.data.find(
  (sub) => sub.status === 'active' || sub.status === 'trialing'
);
const subscription = active ?? subscriptions.data[0] ?? null;

if (!subscription) {
  console.log('\nNo Stripe subscriptions for this customer.');
  console.log('If DB still shows pro, run with --confirm to set plan=free and clear subscription fields.');
  requireConfirmFlag(process.argv);
  await applySubscriptionToUser(
    db,
    user.id,
    {
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: null,
    },
    { clearSubscription: true }
  );
  console.log('Updated user to free (subscription fields cleared).');
  process.exit(0);
}

const priceId = subscription.items.data[0]?.price?.id ?? null;
const next = {
  stripeCustomerId: user.stripeCustomerId,
  stripeSubscriptionId: subscription.id,
  stripePriceId: priceId,
  subscriptionStatus: subscription.status,
};

console.log('\nStripe subscription to apply');
console.log(JSON.stringify(next, null, 2));

const unchanged =
  user.stripeSubscriptionId === next.stripeSubscriptionId &&
  user.subscriptionStatus === next.subscriptionStatus &&
  user.stripePriceId === next.stripePriceId;

if (unchanged) {
  console.log('\nDB already matches Stripe. No changes needed.');
  process.exit(0);
}

requireConfirmFlag(process.argv);
await applySubscriptionToUser(db, user.id, next, {
  clearSubscription: subscription.status === 'canceled',
});

const [updated] = await db
  .select({ plan: users.plan, subscriptionStatus: users.subscriptionStatus })
  .from(users)
  .where(eq(users.id, user.id));

console.log('\nUpdated user');
console.log(JSON.stringify(updated, null, 2));
