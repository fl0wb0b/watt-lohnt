import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
