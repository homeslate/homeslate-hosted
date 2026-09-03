import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../../../drizzle/schema';

function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const sql = neon(connectionString);
  return drizzle({ client: sql, schema });
}

export { getDb };
export type Db = ReturnType<typeof getDb>;
export * from '../../../../drizzle/schema';
