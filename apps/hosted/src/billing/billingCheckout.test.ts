import { describe, expect, it } from 'vitest';
import { handler } from '../../netlify/functions/billing-checkout';

describe('POST /api/billing/checkout', () => {
  it('returns 401 without a bearer token', async () => {
    const response = await handler(
      { httpMethod: 'POST', headers: {}, body: JSON.stringify({ priceId: 'price_m' }) } as never,
      {} as never
    );

    expect(response).toMatchObject({ statusCode: 401 });
    expect(JSON.parse((response as { body: string }).body)).toEqual({ error: 'Unauthorized' });
  });
});
