import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { users } from '../db';
import type { PlanId } from './plans';

export function planFromSubscriptionStatus(status: string | null | undefined): PlanId {
  if (status === 'active' || status === 'trialing') return 'pro';
  return 'free';
}

export type SubscriptionSyncData = {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  subscriptionStatus: string | null;
};

export function subscriptionFieldsForPlan(
  plan: PlanId,
  data: SubscriptionSyncData
): {
  plan: PlanId;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  subscriptionStatus: string | null;
} {
  if (plan === 'free') {
    return {
      plan: 'free',
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: null,
    };
  }

  return {
    plan: 'pro',
    stripeCustomerId: data.stripeCustomerId,
    stripeSubscriptionId: data.stripeSubscriptionId,
    stripePriceId: data.stripePriceId,
    subscriptionStatus: data.subscriptionStatus,
  };
}

export async function applySubscriptionToUser(
  db: Db,
  userId: string,
  data: SubscriptionSyncData
): Promise<void> {
  const plan = planFromSubscriptionStatus(data.subscriptionStatus);
  const fields = subscriptionFieldsForPlan(plan, data);
  await db.update(users).set(fields).where(eq(users.id, userId));
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
