import { describe, expect, it } from 'vitest';
import type { Db } from '../db';
import {
  applySubscriptionToUser,
  hasActiveSubscription,
  planFromSubscriptionStatus,
  shouldOpenPortalInsteadOfCheckout,
  resolveSubscriptionUserId,
  subscriptionFieldsForPlan,
} from './syncSubscription';

describe('planFromSubscriptionStatus', () => {
  it('active → pro', () => {
    expect(planFromSubscriptionStatus('active')).toBe('pro');
  });

  it('trialing → pro', () => {
    expect(planFromSubscriptionStatus('trialing')).toBe('pro');
  });

  it('canceled → free', () => {
    expect(planFromSubscriptionStatus('canceled')).toBe('free');
  });

  it('past_due → free', () => {
    expect(planFromSubscriptionStatus('past_due')).toBe('free');
  });

  it('null → free', () => {
    expect(planFromSubscriptionStatus(null)).toBe('free');
  });
});

const stripeFields = {
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_123',
  stripePriceId: 'price_m',
  subscriptionStatus: 'past_due',
};

describe('subscriptionFieldsForPlan', () => {
  it('keeps Stripe ids and status when plan is free (past_due / unpaid)', () => {
    expect(subscriptionFieldsForPlan('free', stripeFields)).toEqual({
      plan: 'free',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripePriceId: 'price_m',
      subscriptionStatus: 'past_due',
    });
  });

  it('persists Stripe ids when plan is pro', () => {
    expect(
      subscriptionFieldsForPlan('pro', {
        ...stripeFields,
        subscriptionStatus: 'active',
      })
    ).toEqual({
      plan: 'pro',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripePriceId: 'price_m',
      subscriptionStatus: 'active',
    });
  });

  it('clears subscription id/price/status only when explicitly requested (deleted)', () => {
    expect(subscriptionFieldsForPlan('free', stripeFields, { clearSubscription: true })).toEqual({
      plan: 'free',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: null,
    });
  });
});

describe('hasActiveSubscription', () => {
  it('is true for active or trialing with a subscription id', () => {
    expect(hasActiveSubscription('active', 'sub_1')).toBe(true);
    expect(hasActiveSubscription('trialing', 'sub_1')).toBe(true);
  });

  it('is false when canceled, past_due, or missing id', () => {
    expect(hasActiveSubscription('canceled', 'sub_1')).toBe(false);
    expect(hasActiveSubscription('past_due', 'sub_1')).toBe(false);
    expect(hasActiveSubscription('active', null)).toBe(false);
  });
});

describe('shouldOpenPortalInsteadOfCheckout', () => {
  it('sends past_due and unpaid subscribers to the portal to avoid a second subscription', () => {
    expect(shouldOpenPortalInsteadOfCheckout('past_due', 'sub_1', 'cus_1')).toBe(true);
    expect(shouldOpenPortalInsteadOfCheckout('unpaid', 'sub_1', 'cus_1')).toBe(true);
    expect(shouldOpenPortalInsteadOfCheckout('active', 'sub_1', 'cus_1')).toBe(true);
  });

  it('allows checkout after cancel or when no subscription exists', () => {
    expect(shouldOpenPortalInsteadOfCheckout('canceled', 'sub_1', 'cus_1')).toBe(false);
    expect(shouldOpenPortalInsteadOfCheckout('active', null, 'cus_1')).toBe(false);
    expect(shouldOpenPortalInsteadOfCheckout('active', 'sub_1', null)).toBe(false);
  });
});

function mockUpdateDb(updatedRows: { id: string }[]) {
  const calls: { fields: unknown; userId: unknown }[] = [];
  const db = {
    update: () => ({
      set: (fields: unknown) => ({
        where: (userId: unknown) => {
          calls.push({ fields, userId });
          return {
            returning: () => Promise.resolve(updatedRows),
          };
        },
      }),
    }),
  } as unknown as Db;
  return { db, calls };
}

describe('applySubscriptionToUser', () => {
  it('writes plan plus Stripe fields for past_due without wiping ids', async () => {
    const { db, calls } = mockUpdateDb([{ id: 'user-1' }]);
    await applySubscriptionToUser(db, 'user-1', stripeFields);
    expect(calls[0]?.fields).toEqual({
      plan: 'free',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripePriceId: 'price_m',
      subscriptionStatus: 'past_due',
    });
  });

  it('clears subscription fields on deleted', async () => {
    const { db, calls } = mockUpdateDb([{ id: 'user-1' }]);
    await applySubscriptionToUser(db, 'user-1', stripeFields, { clearSubscription: true });
    expect(calls[0]?.fields).toEqual({
      plan: 'free',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: null,
    });
  });

  it('throws when no user row is updated so Stripe can retry', async () => {
    const { db } = mockUpdateDb([]);
    await expect(applySubscriptionToUser(db, 'missing', stripeFields)).rejects.toThrow(
      'No user row for subscription sync'
    );
  });
});

describe('resolveSubscriptionUserId', () => {
  it('prefers subscription metadata userId', async () => {
    const db = {} as Db;
    const userId = await resolveSubscriptionUserId(db, {
      id: 'sub_1',
      metadata: { userId: 'user-from-meta' },
      customer: 'cus_1',
    });
    expect(userId).toBe('user-from-meta');
  });
});
