/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_BILLING_ENABLED?: string;
  readonly VITE_STRIPE_PRICE_MONTHLY?: string;
  readonly VITE_STRIPE_PRICE_ANNUAL?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:pwa-register' {
  import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}
