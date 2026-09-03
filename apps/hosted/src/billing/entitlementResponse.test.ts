import { describe, expect, it } from 'vitest';
import { EntitlementError } from './entitlementError';
import { AUTH_JSON_HEADERS, entitlementResponse } from '../../netlify/functions/_shared/http';

describe('entitlementResponse', () => {
  it('returns 403 with error and code', () => {
    const err = new EntitlementError('display_limit', 'Display limit reached');
    const response = entitlementResponse(err, AUTH_JSON_HEADERS);

    expect(response.statusCode).toBe(403);
    expect(response.headers).toBe(AUTH_JSON_HEADERS);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Display limit reached',
      code: 'display_limit',
    });
  });
});
