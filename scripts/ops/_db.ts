import { eq, sql } from 'drizzle-orm';
import { requireProdDatabaseUrl } from './_env.ts';
import {
  getDb,
  users,
  displays,
  type Db,
} from '../../apps/hosted/src/db/index.ts';

process.env.DATABASE_URL = requireProdDatabaseUrl();

export { getDb, users, displays };

export async function findUserByEmail(db: Db, email: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      plan: users.plan,
      stripeCustomerId: users.stripeCustomerId,
      stripeSubscriptionId: users.stripeSubscriptionId,
      stripePriceId: users.stripePriceId,
      subscriptionStatus: users.subscriptionStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email.trim()})`);

  return user ?? null;
}

export async function listOwnedDisplays(db: Db, userId: string) {
  return db
    .select({
      id: displays.id,
      displayId: displays.displayId,
      name: displays.name,
      createdAt: displays.createdAt,
    })
    .from(displays)
    .where(eq(displays.userId, userId))
    .orderBy(displays.createdAt);
}
