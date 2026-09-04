import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

config();
config({ path: '.env.local' });

const prodUrl = process.env.DATABASE_URL_PROD;
if (!prodUrl) {
  console.error('DATABASE_URL_PROD is required (set it in .env.local or environment).');
  process.exit(1);
}

console.warn('Opening Drizzle Studio against DATABASE_URL_PROD. Avoid writes unless you know the impact.');

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['drizzle-kit', 'studio'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: prodUrl,
    },
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
