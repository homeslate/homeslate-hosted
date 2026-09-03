import { describe, expect, it } from 'vitest';
import type { Db } from '../db';
import { checkCreateDisplayEntitlement } from './checkCreateDisplayEntitlement';
import { EntitlementError } from './entitlementError';

function mockDb(displayCount: number): Db {
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ cnt: displayCount }]),
      }),
    }),
  } as unknown as Db;
}

describe('checkCreateDisplayEntitlement', () => {
  it('allows first display on free', async () => {
    await expect(checkCreateDisplayEntitlement(mockDb(0), 'user-id', 'free')).resolves.toBeUndefined();
  });

  it('blocks second display on free', async () => {
    await expect(checkCreateDisplayEntitlement(mockDb(1), 'user-id', 'free')).rejects.toThrow(EntitlementError);
    try {
      await checkCreateDisplayEntitlement(mockDb(1), 'user-id', 'free');
    } catch (e) {
      expect((e as EntitlementError).code).toBe('display_limit');
    }
  });

  it('allows unlimited displays on pro', async () => {
    await expect(checkCreateDisplayEntitlement(mockDb(99), 'user-id', 'pro')).resolves.toBeUndefined();
  });
});

describe('entitlement HTTP mapping', () => {
  it('EntitlementError has display_limit code', () => {
    const err = new EntitlementError('display_limit', 'Display limit reached');
    expect(err.code).toBe('display_limit');
  });
});
