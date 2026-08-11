import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/sedgwick-ave-display'
import './index.css'
import App from './App.tsx'

// PWA (vite-plugin-pwa, autoUpdate): der neue Service Worker aktiviert sich automatisch. Sobald
// er die Kontrolle übernimmt, einmalig neu laden, damit Nutzer nie auf einer veralteten Version
// hängen bleiben (statt manuellem Hard-Reload).
if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })

  // Ein dauerhaft offener Tab prüft sonst nie auf Updates – deshalb regelmäßig und bei
  // Tab-Fokus aktiv nach einer neuen Version suchen.
  navigator.serviceWorker.ready.then((registration) => {
    const check = () => registration.update().catch(() => {})
    setInterval(check, 60_000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
