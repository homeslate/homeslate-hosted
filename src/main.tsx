import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

// In dev mode, evict any stale service worker left over from a production build.
// A live SW returning cached built assets (e.g. /assets/index-abc.js) while Vite
// serves source paths causes MIME-type errors on the first load.
if (import.meta.env.DEV && navigator.serviceWorker?.controller) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    Promise.all(regs.map((r) => r.unregister())).then(() => location.reload());
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
