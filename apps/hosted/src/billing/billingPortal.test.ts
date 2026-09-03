import { describe, expect, it } from 'vitest';
import { handler } from '../../netlify/functions/billing-portal';

describe('POST /api/billing/portal', () => {
  it('returns 401 without a bearer token', async () => {
    const response = await handler(
      { httpMethod: 'POST', headers: {}, body: '{}' } as never,
      {} as never
    );

    expect(response).toMatchObject({ statusCode: 401 });
    expect(JSON.parse((response as { body: string }).body)).toEqual({ error: 'Unauthorized' });
  });
});
