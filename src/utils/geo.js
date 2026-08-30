// Gemeinsamer Standort fuer die ganze App.
//
// Vorher holte sich jeder Screen (Entdecken, Ortspicker, Weltkarte) den
// Standort selbst und fing dabei jedes Mal bei null an — die Weltkarte musste
// deshalb ein bis drei Sekunden warten, zeigte solange die eigenen Spots und
// flog danach sichtbar zum Standort. Hier liegt der zuletzt bekannte Standort
// im Modul-State UND im localStorage, damit er direkt beim ersten Frame nach
// App-Start synchron zur Verfuegung steht.

const STORAGE_KEY = 'rankify_last_location'
// Aelter als das nehmen wir nicht mehr als Startpunkt an.
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000

let cached = null // { lat, lng, ts }
let inflight = null

function isValid(pos) {
  return (
    pos &&
    Number.isFinite(pos.lat) &&
    Number.isFinite(pos.lng) &&
    Number.isFinite(pos.ts)
  )
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStored(pos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
  } catch {
    // Speicher voll oder gesperrt — der Modul-Cache reicht fuer diese Sitzung.
  }
}

function forget() {
  cached = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // egal
  }
}

/**
 * Zuletzt bekannter Standort — synchron, ohne Wartezeit.
 * Gibt null zurueck, wenn nie einer da war oder er zu alt ist.
 */
export function getLastKnownLocation(maxAgeMs = MAX_CACHE_AGE_MS) {
  if (!cached) cached = readStored()
  if (!cached) return null
  if (Date.now() - cached.ts > maxAgeMs) return null
  return { lat: cached.lat, lng: cached.lng }
}

/**
 * Frischen Standort holen und den Cache aktualisieren.
 * Mehrfachaufrufe waehrend einer laufenden Abfrage teilen sich dieselbe.
 * Aufloesung mit null = nicht verfuegbar, abgelehnt oder Zeitueberschreitung.
 */
export function getLocation({ timeout = 8000, maximumAge = 300000, enableHighAccuracy = false } = {}) {
  if (inflight) return inflight
  if (!navigator.geolocation) return Promise.resolve(null)

  inflight = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        cached = { lat: coords.latitude, lng: coords.longitude, ts: Date.now() }
        writeStored(cached)
        resolve({ lat: cached.lat, lng: cached.lng })
      },
      (err) => {
        // Berechtigung entzogen → den gespeicherten Standort nicht weiter
        // verwenden. Bei Zeitueberschreitung/Ortungsfehler bleibt er liegen.
        if (err?.code === 1) forget()
        resolve(null)
      },
      { enableHighAccuracy, timeout, maximumAge }
    )
  }).finally(() => {
    inflight = null
  })

  return inflight
}

/**
 * Einen anderswo ermittelten Standort in den gemeinsamen Speicher legen.
 * Fuer Stellen mit eigenem Ortungsbedarf (der Ortspicker misst metergenau und
 * darf sich deshalb nicht an eine laufende Standardabfrage haengen).
 */
export function rememberLocation(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
  cached = { lat, lng, ts: Date.now() }
  writeStored(cached)
}

/**
 * Standort im Hintergrund vorwaermen (App-Start). Loest beim allerersten Mal
 * die Berechtigungsabfrage aus, damit spaeter jeder Screen sofort losstarten
 * kann. Bewusst ohne await — der Aufrufer wartet nie darauf.
 *
 * Feuert garantiert nur einmal pro Sitzung: der Aufrufer haengt an der
 * Anmeldung, und Supabase meldet auch bei Token-Erneuerung und beim
 * Zurueckkehren in die App eine Aenderung.
 */
let primed = false
export function primeLocation() {
  if (primed) return
  primed = true
  getLocation().catch(() => {})
}

/** Entfernung zweier Punkte in Kilometern (Haversine). */
export function distanceKm(a, b) {
  if (!a || !b) return Infinity
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}
