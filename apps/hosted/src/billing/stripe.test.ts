import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getAllowedPriceIds, isAllowedPriceId } from './stripe';

describe('isAllowedPriceId', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.STRIPE_PRICE_MONTHLY = 'price_m';
    process.env.STRIPE_PRICE_ANNUAL = 'price_a';
  });

  afterEach(() => {
    process.env = env;
  });

  it('accepts configured monthly and annual ids', () => {
    expect(isAllowedPriceId('price_m')).toBe(true);
    expect(isAllowedPriceId('price_a')).toBe(true);
    expect(isAllowedPriceId('price_other')).toBe(false);
  });

  it('getAllowedPriceIds returns configured ids', () => {
    expect(getAllowedPriceIds()).toEqual(['price_m', 'price_a']);
  });
});
