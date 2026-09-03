import { describe, expect, it } from 'vitest';
import { PLAN_ENTITLEMENTS, DEFAULT_PLAN } from './plans';

describe('plans', () => {
  it('defaults to free', () => {
    expect(DEFAULT_PLAN).toBe('free');
  });

  it('free tier limits', () => {
    expect(PLAN_ENTITLEMENTS.free.maxDisplays).toBe(1);
    expect(PLAN_ENTITLEMENTS.free.maxViewsPerDisplay).toBe(3);
  });

  it('pro tier is unlimited', () => {
    expect(PLAN_ENTITLEMENTS.pro.maxDisplays).toBeNull();
    expect(PLAN_ENTITLEMENTS.pro.maxViewsPerDisplay).toBeNull();
  });
});
