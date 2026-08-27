import { supabase } from '../services/supabase'

// Zentrale MapKit-JS-Ladelogik (Token via swift-worker Edge Function).
// Wird von SpotMapSheet, LocationPickerSheet und der Weltkarte genutzt.

const MAPKIT_CDN = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js'

let scriptPromise = null
let mkInitialized = false
let tokenCache = null

async function fetchToken() {
  const now = Math.floor(Date.now() / 1000)
  if (tokenCache && tokenCache.exp > now + 60) return tokenCache.token
  const { data, error } = await supabase.functions.invoke('swift-worker')
  if (error) throw new Error(`Edge Function Fehler: ${error.message}`)
  if (!data?.token) throw new Error('Kein Token erhalten')
  tokenCache = data
  return data.token
}

function loadScript() {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${MAPKIT_CDN}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = MAPKIT_CDN
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('MapKit JS konnte nicht geladen werden'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

// Lädt MapKit JS und initialisiert es (idempotent). Danach ist window.mapkit
// verfügbar. Wirft bei Lade-/Token-Fehlern.
export async function ensureMapkit() {
  await loadScript()
  if (!mkInitialized) {
    mkInitialized = true
    window.mapkit.init({
      authorizationCallback: async (done) => {
        try { done(await fetchToken()) }
        catch (e) { mkInitialized = false; tokenCache = null; throw e }
      },
      language: 'de',
    })
  }
  return window.mapkit
}
