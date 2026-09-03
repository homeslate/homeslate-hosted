import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { displays } from '../db';
import { assertCanCreateDisplay } from './entitlements';
import { entitlementsForPlan } from './plans';

export async function checkCreateDisplayEntitlement(
  db: Db,
  userId: string,
  plan: string | null | undefined
): Promise<void> {
  const countRows = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(displays)
    .where(eq(displays.userId, userId));

  const ownedDisplayCount = Number(countRows[0]?.cnt ?? 0);
  assertCanCreateDisplay(ownedDisplayCount, entitlementsForPlan(plan));
}
