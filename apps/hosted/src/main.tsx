import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { initSentryClient, Sentry } from './monitoring/sentry.client'

initSentryClient()

function SentryFallback() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Something went wrong</h1>
      <p>Please refresh the page. If the problem persists, contact support@homeslate.dev.</p>
      <button type="button" onClick={() => window.location.reload()}>
        Refresh
      </button>
    </div>
  )
}

// PWA: register service worker with auto-update and periodic checks.
// Without importing virtual:pwa-register, the browser won't reload when a new version is available.
// For a long-running display, check for updates every 30 minutes.
if (import.meta.env.PROD) {
  const CHECK_INTERVAL_MS = 30 * 60 * 1000
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      setInterval(async () => {
        if (registration.installing || !navigator) return
        if ('connection' in navigator && !navigator.onLine) return
        try {
          const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: { cache: 'no-store', 'cache-control': 'no-cache' },
          })
          if (resp?.status === 200) await registration.update()
        } catch {
          // Ignore fetch errors (offline, server down)
        }
      }, CHECK_INTERVAL_MS)
    },
  })
}

// In dev mode, evict any stale service worker left over from a production build.
// A live SW returning cached built assets (e.g. /assets/index-abc.js) while Vite
// serves source paths causes MIME-type errors on the first load.
if (import.meta.env.DEV && navigator.serviceWorker?.controller) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    Promise.all(regs.map((r) => r.unregister())).then(() => location.reload());
  });
}

// Boot fallback: render auth/pair pages with a minimal --token-* set until ThemeProvider
// runs and stamps the full namespace on the viewer root. See App.css :root[data-theme-fallback].
document.documentElement.dataset.themeFallback = ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
