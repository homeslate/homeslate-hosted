import { describe, expect, it } from 'vitest';
import { PLAN_ENTITLEMENTS } from './plans';
import { assertCanCreateDisplay, assertViewCount } from './entitlements';
import { EntitlementError } from './entitlementError';

describe('assertCanCreateDisplay', () => {
  it('allows first display on free', () => {
    expect(() => assertCanCreateDisplay(0, PLAN_ENTITLEMENTS.free)).not.toThrow();
  });

  it('blocks second display on free', () => {
    expect(() => assertCanCreateDisplay(1, PLAN_ENTITLEMENTS.free)).toThrow(EntitlementError);
    try {
      assertCanCreateDisplay(1, PLAN_ENTITLEMENTS.free);
    } catch (e) {
      expect((e as EntitlementError).code).toBe('display_limit');
    }
  });

  it('allows unlimited on pro', () => {
    expect(() => assertCanCreateDisplay(99, PLAN_ENTITLEMENTS.pro)).not.toThrow();
  });
});

describe('assertViewCount', () => {
  it('allows 3 views on free', () => {
    expect(() => assertViewCount(3, PLAN_ENTITLEMENTS.free)).not.toThrow();
  });

  it('blocks 4 views on free', () => {
    expect(() => assertViewCount(4, PLAN_ENTITLEMENTS.free)).toThrow(EntitlementError);
    try {
      assertViewCount(4, PLAN_ENTITLEMENTS.free);
    } catch (e) {
      expect((e as EntitlementError).code).toBe('view_limit');
    }
  });
});
