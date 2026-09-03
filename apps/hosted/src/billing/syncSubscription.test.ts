import { describe, expect, it } from 'vitest';
import { planFromSubscriptionStatus } from './syncSubscription';

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

  it('null → free', () => {
    expect(planFromSubscriptionStatus(null)).toBe('free');
  });
});
