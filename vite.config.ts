import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => ({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
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
    command === 'build' && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'vite.svg', 'icons/*.png'],
      manifest: {
        name: 'Kitchen Display',
        short_name: 'Kitchen',
        description: 'Smart kitchen dashboard',
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
