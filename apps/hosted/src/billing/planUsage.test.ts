import { describe, expect, it } from 'vitest';
import { accountPlanUsage, viewPlanUsage } from './planUsage';

describe('accountPlanUsage', () => {
  it('returns null for pro plan', () => {
    expect(accountPlanUsage('pro', 5, 10)).toBeNull();
  });

  it('formats display-only usage when no view count', () => {
    expect(accountPlanUsage('free', 0)).toEqual({
      label: '0/1 displays',
      atLimit: false,
      emphasized: false,
    });
  });

  it('formats combined display and view usage', () => {
    expect(accountPlanUsage('free', 1, 2)).toEqual({
      label: '1/1 display · 2/3 views',
      atLimit: true,
      emphasized: false,
    });
  });

  it('marks at limit when display cap is reached', () => {
    expect(accountPlanUsage('free', 1, 1)).toEqual({
      label: '1/1 display · 1/3 view',
      atLimit: true,
      emphasized: false,
    });
  });

  it('marks at limit when view cap is reached', () => {
    expect(accountPlanUsage('free', 1, 3)).toEqual({
      label: '1/1 display · 3/3 views',
      atLimit: true,
      emphasized: true,
    });
  });
});

describe('viewPlanUsage', () => {
  it('returns null for pro plan', () => {
    expect(viewPlanUsage('pro', 10)).toBeNull();
  });

  it('formats view usage for free plan', () => {
    expect(viewPlanUsage('free', 2)).toEqual({
      label: '2/3 views',
      atLimit: false,
      emphasized: false,
    });
  });

  it('marks at limit on the final allowed view', () => {
    expect(viewPlanUsage('free', 3)).toEqual({
      label: '3/3 views',
      atLimit: true,
      emphasized: true,
    });
  });
});
