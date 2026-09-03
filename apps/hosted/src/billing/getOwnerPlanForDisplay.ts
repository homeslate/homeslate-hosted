import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db';
import { displays, users } from '../db';

export async function getOwnerPlanForDisplay(
  db: Db,
  displayId: string
): Promise<string | null> {
  const rows = await db
    .select({ plan: users.plan })
    .from(displays)
    .innerJoin(users, eq(users.id, displays.userId))
    .where(sql`${displays.id} = ${displayId}::uuid`);

  return rows[0]?.plan ?? null;
}
