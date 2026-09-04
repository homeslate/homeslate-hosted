import { config } from 'dotenv';

config();
config({ path: '.env.local' });

export function requireProdDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_PROD ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Set DATABASE_URL_PROD (or DATABASE_URL) in .env.local');
  }
  return url;
}

export function requireStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Set STRIPE_SECRET_KEY in .env.local (use test or live key intentionally)');
  }
  return key;
}

export function usage(message: string): never {
  console.error(message);
  process.exit(1);
}

export function requireConfirmFlag(argv: string[]): void {
  if (!argv.includes('--confirm')) {
    usage('Missing --confirm. Re-run with --confirm after reviewing the output above.');
  }
}
