import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@homeslate/schema': fileURLToPath(
        new URL('../../packages/schema/src/index.ts', import.meta.url),
      ),
      '@homeslate/google': fileURLToPath(
        new URL('../../packages/google/src/index.ts', import.meta.url),
      ),
      '@homeslate/widgets/schemas': fileURLToPath(
        new URL('../../packages/widgets/src/schemas.ts', import.meta.url),
      ),
      '@homeslate/widgets/server': fileURLToPath(
        new URL('../../packages/widgets/src/server.ts', import.meta.url),
      ),
      '@homeslate/widgets': fileURLToPath(
        new URL('../../packages/widgets/src/index.ts', import.meta.url),
      ),
      '@homeslate/display/canvas': fileURLToPath(
        new URL('../../packages/display/src/canvas/index.ts', import.meta.url),
      ),
      '@homeslate/display': fileURLToPath(
        new URL('../../packages/display/src/index.ts', import.meta.url),
      ),
      '@homeslate/editor': fileURLToPath(
        new URL('../../packages/editor/src/index.ts', import.meta.url),
      ),
      '@homeslate/adapters': fileURLToPath(
        new URL('../../packages/adapters/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
