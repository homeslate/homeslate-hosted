import { wouldExceedDisplayLimit, wouldExceedViewLimit } from './entitlements';
import { entitlementsForPlan } from './plans';

export type PlanUsageDisplay = {
  label: string;
  /** User cannot add another display or view without upgrading. */
  atLimit: boolean;
  /** Highlight the badge (view cap reached, or display-only usage at cap). */
  emphasized: boolean;
};

export function accountPlanUsage(
  plan: string | null | undefined,
  ownedDisplayCount: number,
  viewCount?: number | null
): PlanUsageDisplay | null {
  const entitlements = entitlementsForPlan(plan);
  if (entitlements.maxDisplays === null) return null;

  const displayNoun = ownedDisplayCount === 1 ? 'display' : 'displays';
  const displaysPart = `${ownedDisplayCount}/${entitlements.maxDisplays} ${displayNoun}`;
  const displayAtLimit = wouldExceedDisplayLimit(ownedDisplayCount, entitlements);

  if (viewCount == null || entitlements.maxViewsPerDisplay === null) {
    return {
      label: displaysPart,
      atLimit: displayAtLimit,
      emphasized: displayAtLimit,
    };
  }

  const viewNoun = viewCount === 1 ? 'view' : 'views';
  const viewsPart = `${viewCount}/${entitlements.maxViewsPerDisplay} ${viewNoun}`;
  const viewAtLimit = wouldExceedViewLimit(viewCount, 1, entitlements);

  return {
    label: `${displaysPart} · ${viewsPart}`,
    atLimit: displayAtLimit || viewAtLimit,
    emphasized: viewAtLimit,
  };
}

export function viewPlanUsage(
  plan: string | null | undefined,
  viewCount: number
): PlanUsageDisplay | null {
  const entitlements = entitlementsForPlan(plan);
  if (entitlements.maxViewsPerDisplay === null) return null;

  const viewNoun = viewCount === 1 ? 'view' : 'views';
  const atLimit = wouldExceedViewLimit(viewCount, 1, entitlements);
  return {
    label: `${viewCount}/${entitlements.maxViewsPerDisplay} ${viewNoun}`,
    atLimit,
    emphasized: atLimit,
  };
}
