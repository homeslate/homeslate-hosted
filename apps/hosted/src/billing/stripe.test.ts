import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  billingCancelUrl,
  billingSuccessUrl,
  buildCheckoutSessionParams,
  getAllowedPriceIds,
  isAllowedPriceId,
  rawWebhookBody,
} from './stripe';

describe('isAllowedPriceId', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.STRIPE_PRICE_MONTHLY = 'price_m';
    process.env.STRIPE_PRICE_ANNUAL = 'price_a';
    delete process.env.BILLING_SUCCESS_URL;
    delete process.env.BILLING_CANCEL_URL;
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

describe('billing redirect URLs', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.BILLING_SUCCESS_URL;
    delete process.env.BILLING_CANCEL_URL;
  });

  afterEach(() => {
    process.env = env;
  });

  it('uses configured env URLs', () => {
    process.env.BILLING_SUCCESS_URL = 'https://homeslate.dev/displays?upgraded=1';
    process.env.BILLING_CANCEL_URL = 'https://homeslate.dev/displays';
    expect(billingSuccessUrl()).toBe('https://homeslate.dev/displays?upgraded=1');
    expect(billingCancelUrl()).toBe('https://homeslate.dev/displays');
  });

  it('falls back to origin when env is unset', () => {
    expect(billingSuccessUrl('https://preview.netlify.app')).toBe(
      'https://preview.netlify.app/displays?upgraded=1'
    );
    expect(billingCancelUrl('https://preview.netlify.app')).toBe('https://preview.netlify.app/displays');
  });

  it('rejects relative or missing URLs (Stripe requires absolute)', () => {
    expect(() => billingSuccessUrl()).toThrow('BILLING_SUCCESS_URL');
    expect(() => billingCancelUrl()).toThrow('BILLING_CANCEL_URL');
  });
});

describe('buildCheckoutSessionParams', () => {
  it('sets userId on session and subscription metadata', () => {
    expect(
      buildCheckoutSessionParams({
        userId: 'user-1',
        email: 'a@b.com',
        stripeCustomerId: null,
        priceId: 'price_m',
        successUrl: 'https://homeslate.dev/ok',
        cancelUrl: 'https://homeslate.dev/cancel',
      })
    ).toEqual({
      mode: 'subscription',
      line_items: [{ price: 'price_m', quantity: 1 }],
      success_url: 'https://homeslate.dev/ok',
      cancel_url: 'https://homeslate.dev/cancel',
      client_reference_id: 'user-1',
      metadata: { userId: 'user-1' },
      subscription_data: { metadata: { userId: 'user-1' } },
      customer_email: 'a@b.com',
    });
  });

  it('reuses an existing customer and omits customer_email', () => {
    const params = buildCheckoutSessionParams({
      userId: 'user-1',
      email: 'a@b.com',
      stripeCustomerId: 'cus_1',
      priceId: 'price_m',
      successUrl: 'https://homeslate.dev/ok',
      cancelUrl: 'https://homeslate.dev/cancel',
    });
    expect(params.customer).toBe('cus_1');
    expect(params.customer_email).toBeUndefined();
  });
});

describe('rawWebhookBody', () => {
  it('returns the body as-is when not base64 encoded', () => {
    expect(rawWebhookBody({ body: '{"id":"evt"}', isBase64Encoded: false })).toBe('{"id":"evt"}');
  });

  it('decodes base64 bodies from Netlify/Lambda', () => {
    const raw = '{"id":"evt_1"}';
    expect(
      rawWebhookBody({
        body: Buffer.from(raw, 'utf8').toString('base64'),
        isBase64Encoded: true,
      })
    ).toBe(raw);
  });
});
