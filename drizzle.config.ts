import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env then .env.local (local overrides) so drizzle-kit has DATABASE_URL
config();
config({ path: '.env.local', override: true });

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
