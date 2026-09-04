#!/usr/bin/env node
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { requireConfirmFlag, requireStripeSecretKey, usage } from './_env.ts';
import { findUserByEmail, getDb, users } from './_db.ts';
import { hasActiveSubscription } from '../../apps/hosted/src/billing/syncSubscription.ts';

const argv = process.argv.slice(2);
const email = argv.find((arg) => !arg.startsWith('-'));
if (!email) {
  usage('Usage: npm run ops:grant-pro-comp -- <email> --confirm');
}

const db = getDb();
const user = await findUserByEmail(db, email);

if (!user) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}

console.log('Current DB row');
console.log(JSON.stringify(user, null, 2));

if (user.plan === 'pro' && !hasActiveSubscription(user.subscriptionStatus, user.stripeSubscriptionId)) {
  console.log('\nUser is already on comp Pro (no active Stripe subscription).');
  process.exit(0);
}

if (hasActiveSubscription(user.subscriptionStatus, user.stripeSubscriptionId)) {
  console.error(
    '\nUser has an active Stripe subscription in the DB. Use Stripe Dashboard or ops:sync-stripe-user instead.'
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
      `\nStripe still has active subscription ${active.id}. Cancel in Stripe first, then sync with ops:sync-stripe-user.`
    );
    process.exit(1);
  }
}

console.log('\nWill set plan=pro without creating a Stripe subscription (comp / beta access).');
console.log('Stripe billing fields are left unchanged for audit history.');
requireConfirmFlag(argv);

await db.update(users).set({ plan: 'pro' }).where(eq(users.id, user.id));

const [updated] = await db
  .select({ email: users.email, plan: users.plan, subscriptionStatus: users.subscriptionStatus })
  .from(users)
  .where(eq(users.id, user.id));

console.log('\nUpdated user');
console.log(JSON.stringify(updated, null, 2));
