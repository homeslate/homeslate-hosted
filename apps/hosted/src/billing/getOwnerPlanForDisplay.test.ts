import { describe, expect, it } from 'vitest';
import type { Db } from '../db';
import { getOwnerPlanForDisplay } from './getOwnerPlanForDisplay';
import { assertViewCount } from './entitlements';
import { entitlementsForPlan } from './plans';
import { EntitlementError } from './entitlementError';

function mockDb(plan: string | null): Db {
  return {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve(plan === null ? [] : [{ plan }]),
        }),
      }),
    }),
  } as unknown as Db;
}

describe('getOwnerPlanForDisplay', () => {
  it('returns owner plan for display', async () => {
    await expect(getOwnerPlanForDisplay(mockDb('free'), 'display-id')).resolves.toBe('free');
    await expect(getOwnerPlanForDisplay(mockDb('pro'), 'display-id')).resolves.toBe('pro');
  });

  it('returns null when display not found', async () => {
    await expect(getOwnerPlanForDisplay(mockDb(null), 'missing-id')).resolves.toBeNull();
  });
});

describe('config view limit enforcement', () => {
  it('allows up to 3 views on free owner plan', async () => {
    const plan = await getOwnerPlanForDisplay(mockDb('free'), 'display-id');
    expect(() => assertViewCount(3, entitlementsForPlan(plan))).not.toThrow();
  });

  it('blocks 4 views on free owner plan', async () => {
    const plan = await getOwnerPlanForDisplay(mockDb('free'), 'display-id');
    expect(() => assertViewCount(4, entitlementsForPlan(plan))).toThrow(EntitlementError);
    try {
      assertViewCount(4, entitlementsForPlan(plan));
    } catch (e) {
      expect((e as EntitlementError).code).toBe('view_limit');
    }
  });

  it('allows unlimited views on pro owner plan', async () => {
    const plan = await getOwnerPlanForDisplay(mockDb('pro'), 'display-id');
    expect(() => assertViewCount(99, entitlementsForPlan(plan))).not.toThrow();
  });
});
