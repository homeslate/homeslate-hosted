import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { users } from '../db';
import type { PlanId } from './plans';

export function planFromSubscriptionStatus(status: string | null | undefined): PlanId {
  if (status === 'active' || status === 'trialing') return 'pro';
  return 'free';
}

export function hasActiveSubscription(
  status: string | null | undefined,
  subscriptionId: string | null | undefined
): boolean {
  return Boolean(subscriptionId) && (status === 'active' || status === 'trialing');
}

const PORTAL_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
]);

export function shouldOpenPortalInsteadOfCheckout(
  status: string | null | undefined,
  subscriptionId: string | null | undefined,
  customerId: string | null | undefined
): boolean {
  return Boolean(
    customerId && subscriptionId && status && PORTAL_SUBSCRIPTION_STATUSES.has(status)
  );
}

export type SubscriptionSyncData = {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  subscriptionStatus: string | null;
};

export type SubscriptionSyncOptions = {
  clearSubscription?: boolean;
};

export function subscriptionFieldsForPlan(
  plan: PlanId,
  data: SubscriptionSyncData,
  options?: SubscriptionSyncOptions
): {
  plan: PlanId;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  subscriptionStatus: string | null;
} {
  if (options?.clearSubscription) {
    return {
      plan,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: null,
    };
  }

  return {
    plan,
    stripeCustomerId: data.stripeCustomerId,
    stripeSubscriptionId: data.stripeSubscriptionId,
    stripePriceId: data.stripePriceId,
    subscriptionStatus: data.subscriptionStatus,
  };
}

export async function applySubscriptionToUser(
  db: Db,
  userId: string,
  data: SubscriptionSyncData,
  options?: SubscriptionSyncOptions
): Promise<void> {
  const plan = options?.clearSubscription
    ? 'free'
    : planFromSubscriptionStatus(data.subscriptionStatus);
  const fields = subscriptionFieldsForPlan(plan, data, options);
  const updated = await db.update(users).set(fields).where(eq(users.id, userId)).returning({
    id: users.id,
  });
  if (updated.length === 0) {
    throw new Error('No user row for subscription sync');
  }
}

export async function resolveSubscriptionUserId(
  db: Db,
  subscription: {
    id: string;
    metadata?: { userId?: string } | null;
    customer: string | { id: string };
  }
): Promise<string | null> {
  if (subscription.metadata?.userId) return subscription.metadata.userId;
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  return (
    (await findUserIdByStripeSubscriptionId(db, subscription.id)) ??
    (await findUserIdByStripeCustomerId(db, customerId))
  );
}

export async function findUserIdByStripeCustomerId(
  db: Db,
  stripeCustomerId: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId));
  return row?.id ?? null;
}

export async function findUserIdByStripeSubscriptionId(
  db: Db,
  stripeSubscriptionId: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeSubscriptionId, stripeSubscriptionId));
  return row?.id ?? null;
}
