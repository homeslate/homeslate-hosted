import { eq } from 'drizzle-orm';
import type { TokenStore } from '@homeslate/google';
import { getDb, users } from '../../../src/db';

type Db = ReturnType<typeof getDb>;

export function createNeonTokenStore(db: Db): TokenStore {
  const store: TokenStore = {
    async getRefreshToken(accountId) {
      const tokens = await store.getTokens(accountId);
      return tokens?.refreshToken ? tokens.refreshToken : null;
    },
    async getTokens(accountId) {
      const [row] = await db
        .select({
          refreshToken: users.refreshToken,
          accessToken: users.accessToken,
          accessTokenExpiresAt: users.accessTokenExpiresAt,
        })
        .from(users)
        .where(eq(users.id, accountId))
        .limit(1);
      if (!row) return null;
      const refreshToken = row.refreshToken?.trim() ?? '';
      return {
        refreshToken,
        accessToken: row.accessToken ?? undefined,
        expiresAt: row.accessTokenExpiresAt ?? undefined,
      };
    },
    async putTokens(accountId, tokens) {
      const refresh = tokens.refreshToken.trim();
      await db
        .update(users)
        .set({
          accessToken: tokens.accessToken ?? null,
          accessTokenExpiresAt: tokens.expiresAt ?? null,
          ...(refresh ? { refreshToken: refresh } : {}),
        })
        .where(eq(users.id, accountId));
    },
    async deleteTokens(accountId) {
      await db
        .update(users)
        .set({
          refreshToken: null,
          accessToken: null,
          accessTokenExpiresAt: null,
        })
        .where(eq(users.id, accountId));
    },
  };
  return store;
}
