import type { Entitlements } from './plans';
import { EntitlementError } from './entitlementError';

export function assertCanCreateDisplay(ownedDisplayCount: number, entitlements: Entitlements): void {
  if (entitlements.maxDisplays === null) return;
  if (ownedDisplayCount >= entitlements.maxDisplays) {
    throw new EntitlementError('display_limit', 'Display limit reached');
  }
}

export function assertViewCount(viewCount: number, entitlements: Entitlements): void {
  if (entitlements.maxViewsPerDisplay === null) return;
  if (viewCount > entitlements.maxViewsPerDisplay) {
    throw new EntitlementError('view_limit', 'View limit reached');
  }
}
