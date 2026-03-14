import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env then .env.local, but do not override explicit shell env vars.
// This allows commands like DATABASE_URL=... drizzle-kit migrate to target
// a specific database branch safely.
config();
config({ path: '.env.local' });

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
