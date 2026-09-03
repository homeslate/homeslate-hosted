/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => ({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  resolve: {
    alias: {
      '@homeslate/schema': fileURLToPath(
        new URL('../../packages/schema/src/index.ts', import.meta.url)
      ),
      '@homeslate/google': fileURLToPath(
        new URL('../../packages/google/src/index.ts', import.meta.url)
      ),
      '@homeslate/widgets/schemas': fileURLToPath(
        new URL('../../packages/widgets/src/schemas.ts', import.meta.url)
      ),
      '@homeslate/widgets': fileURLToPath(
        new URL('../../packages/widgets/src/index.ts', import.meta.url)
      ),
      '@homeslate/display/canvas': fileURLToPath(
        new URL('../../packages/display/src/canvas/index.ts', import.meta.url)
      ),
      '@homeslate/display': fileURLToPath(
        new URL('../../packages/display/src/index.ts', import.meta.url)
      ),
      '@homeslate/editor': fileURLToPath(
        new URL('../../packages/editor/src/index.ts', import.meta.url)
      ),
      '@homeslate/adapters': fileURLToPath(
        new URL('../../packages/adapters/src/index.ts', import.meta.url)
      ),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../dist', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-mantine': ['@mantine/core', '@mantine/hooks', '@mantine/dates'],
          'vendor-icons': ['@tabler/icons-react'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-grid': ['react-grid-layout'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        rewrite: (path) => path.replace(/^\/api/, '/.netlify/functions'),
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      mode: 'development',
      registerType: 'autoUpdate',
      minify: false,
      includeAssets: ['icon.svg', 'vite.svg', 'icons/*.png'],
      manifest: {
        name: 'Homeslate',
        short_name: 'Homeslate',
        description: 'Smart home display platform',
        theme_color: '#1a1b1e',
        background_color: '#1a1b1e',
        display: 'standalone',
        // display_override: fullscreen hides the Android status bar entirely
        // when the PWA is launched. 'standalone' is the fallback for browsers
        // that don't support display_override.
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          // PNG icons required for Android Chrome install prompt
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Main chunk can exceed 2 MiB; allow up to 4 MiB for precache
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Pre-cache all built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        runtimeCaching: [
          {
            // Weather API — short cache, fall back to stale data if offline
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 30 }, // 30 min
              networkTimeoutSeconds: 5,
            },
          },
          {
            // iCal CORS proxy — short cache
            urlPattern: /^https:\/\/api\.allorigins\.win\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ical-proxy',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 5 }, // 5 min
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Google fonts (if any)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
}))
