import { describe, expect, it } from 'vitest';
import { isUpgradeReturn, shouldContinueUpgradePoll } from './upgradeReturn';

describe('isUpgradeReturn', () => {
  it('is true when upgraded=1', () => {
    expect(isUpgradeReturn('?upgraded=1')).toBe(true);
    expect(isUpgradeReturn('upgraded=1')).toBe(true);
  });

  it('is false otherwise', () => {
    expect(isUpgradeReturn('')).toBe(false);
    expect(isUpgradeReturn('?upgraded=0')).toBe(false);
  });
});

describe('shouldContinueUpgradePoll', () => {
  it('stops once the user is pro', () => {
    expect(shouldContinueUpgradePoll('pro', 0, 8)).toBe(false);
  });

  it('continues while free and under the attempt cap', () => {
    expect(shouldContinueUpgradePoll('free', 0, 8)).toBe(true);
    expect(shouldContinueUpgradePoll('free', 8, 8)).toBe(false);
  });
});
