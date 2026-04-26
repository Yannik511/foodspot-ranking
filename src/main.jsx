import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Registriert den Service Worker und zeigt einen Update-Banner wenn eine neue Version verfügbar ist
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Neue Version verfügbar! Jetzt aktualisieren?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ist offline verfügbar')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
