#!/usr/bin/env node
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { requireConfirmFlag, requireStripeSecretKey, usage } from './_env.ts';
import { findUserByEmail, getDb, users } from './_db.ts';
import { hasActiveSubscription } from '../../apps/hosted/src/billing/syncSubscription.ts';

const argv = process.argv.slice(2);
const email = argv.find((arg) => !arg.startsWith('-'));
if (!email) {
  usage('Usage: npm run ops:revoke-pro-comp -- <email> --confirm');
}

const db = getDb();
const user = await findUserByEmail(db, email);

if (!user) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}

console.log('Current DB row');
console.log(JSON.stringify(user, null, 2));

if (hasActiveSubscription(user.subscriptionStatus, user.stripeSubscriptionId)) {
  console.error(
    '\nUser has an active Stripe subscription. Cancel in Stripe Dashboard — webhooks will set plan=free.'
  );
  process.exit(1);
}

if (user.stripeCustomerId) {
  const stripe = new Stripe(requireStripeSecretKey());
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: 'all',
    limit: 20,
  });
  const active = subscriptions.data.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );
  if (active) {
    console.error(
      `\nStripe still has active subscription ${active.id}. Cancel in Stripe first.`
    );
    process.exit(1);
  }
}

if (user.plan === 'free') {
  console.log('\nUser is already on the free plan.');
  process.exit(0);
}

console.log('\nWill set plan=free (revoke comp Pro). Stripe fields are unchanged.');
requireConfirmFlag(argv);

await db.update(users).set({ plan: 'free' }).where(eq(users.id, user.id));

const [updated] = await db
  .select({ email: users.email, plan: users.plan })
  .from(users)
  .where(eq(users.id, user.id));

console.log('\nUpdated user');
console.log(JSON.stringify(updated, null, 2));
