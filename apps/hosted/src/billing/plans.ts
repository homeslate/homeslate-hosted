export type PlanId = 'free' | 'pro';

export const DEFAULT_PLAN: PlanId = 'free';

export type Entitlements = {
  maxDisplays: number | null;
  maxViewsPerDisplay: number | null;
};

export const PLAN_ENTITLEMENTS: Record<PlanId, Entitlements> = {
  free: { maxDisplays: 1, maxViewsPerDisplay: 3 },
  pro: { maxDisplays: null, maxViewsPerDisplay: null },
};

export function entitlementsForPlan(plan: string | null | undefined): Entitlements {
  if (plan === 'pro') return PLAN_ENTITLEMENTS.pro;
  return PLAN_ENTITLEMENTS.free;
}
