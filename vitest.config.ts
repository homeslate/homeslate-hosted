/// <reference types="vitest" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'virtual:pwa-register': path.join(
        root,
        'apps/hosted/src/test/virtual-pwa-register.ts'
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "apps/hosted/src/**/*.test.ts",
      "apps/hosted/src/**/*.test.tsx",
      "apps/hosted/netlify/functions/**/*.test.ts",
    ],
    globals: false,
    css: false,
  },
});
