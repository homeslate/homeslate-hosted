import * as Sentry from '@sentry/node';

let initialized = false;

function initSentryServer(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.CONTEXT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
  });
  initialized = true;
}

initSentryServer();

export function captureServerException(error: unknown, context?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export async function flushSentry(timeout = 2000): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  await Sentry.flush(timeout);
}
