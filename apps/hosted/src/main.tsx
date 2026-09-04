import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initSentryClient, Sentry } from './monitoring/sentry.client'
import { registerPwaUpdates } from './pwaUpdate'

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

// PWA: prompt-mode updates — display sessions toast before reload; management quiet-activates.
if (import.meta.env.PROD) {
  registerPwaUpdates()
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
