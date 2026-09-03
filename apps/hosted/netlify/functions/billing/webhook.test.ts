import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handler } from './webhook';

describe('POST /api/billing/webhook', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.STRIPE_SECRET_KEY = 'sk_test_review_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_review_123';
  });

  afterEach(() => {
    process.env = env;
  });

  it('returns 400 when signature or body is missing', async () => {
    const response = await handler(
      { httpMethod: 'POST', headers: {}, body: '{"id":"evt"}' } as never,
      {} as never
    );

    expect(response).toMatchObject({ statusCode: 400 });
  });

  it('returns 400 and does not throw through when signature verification fails', async () => {
    const response = await handler(
      {
        httpMethod: 'POST',
        headers: { 'stripe-signature': 't=1,v1=deadbeef' },
        body: '{"id":"evt"}',
      } as never,
      {} as never
    );

    expect(response).toMatchObject({ statusCode: 400, body: 'Invalid signature' });
  });

  it('decodes a base64 body before verification (still 400 on bad sig)', async () => {
    const raw = '{"id":"evt_b64"}';
    const response = await handler(
      {
        httpMethod: 'POST',
        headers: { 'stripe-signature': 't=1,v1=deadbeef' },
        body: Buffer.from(raw, 'utf8').toString('base64'),
        isBase64Encoded: true,
      } as never,
      {} as never
    );

    expect(response).toMatchObject({ statusCode: 400, body: 'Invalid signature' });
  });
});
