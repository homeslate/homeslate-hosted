import { describe, expect, it } from 'vitest';
import { PLAN_ENTITLEMENTS } from './plans';
import { assertCanCreateDisplay, assertViewCount, wouldExceedDisplayLimit, wouldExceedViewLimit } from './entitlements';
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

describe('wouldExceedDisplayLimit', () => {
  it('allows first display on free', () => {
    expect(wouldExceedDisplayLimit(0, PLAN_ENTITLEMENTS.free)).toBe(false);
  });

  it('blocks second display on free', () => {
    expect(wouldExceedDisplayLimit(1, PLAN_ENTITLEMENTS.free)).toBe(true);
  });

  it('allows unlimited on pro', () => {
    expect(wouldExceedDisplayLimit(99, PLAN_ENTITLEMENTS.pro)).toBe(false);
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

describe('wouldExceedViewLimit', () => {
  it('allows adding a view when under the free limit', () => {
    expect(wouldExceedViewLimit(2, 1, PLAN_ENTITLEMENTS.free)).toBe(false);
  });

  it('blocks adding a 4th view on free', () => {
    expect(wouldExceedViewLimit(3, 1, PLAN_ENTITLEMENTS.free)).toBe(true);
  });

  it('allows any number on pro', () => {
    expect(wouldExceedViewLimit(99, 1, PLAN_ENTITLEMENTS.pro)).toBe(false);
  });
});
