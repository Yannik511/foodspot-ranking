import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { ensureMapkit } from '../lib/mapkit'
import { getMyMappedSpots } from '../services/mySpots'
import { getLastKnownLocation, getLocation, distanceKm } from '../utils/geo'
import { hapticFeedback } from '../utils/haptics'

// Bewertung eines Spots als kurzer Text (Durchschnitt/Overall wie in der App).
function ratingLabel(spot) {
  const v = spot.avg_score ?? spot.rating
  if (v != null) return `★ ${Number(v).toFixed(1)}`
  return ''
}

// Startausschnitt: rund 25 km Umkreis um den eigenen Standort — gemessen an
// der HOEHE des Bildschirms, das ist hochkant die lange Seite.
//
// Achtung, hier steckte der Fehler: MapKit haelt die Spannweite nur ein,
// solange sie zum Seitenverhaeltnis der Karte passt. Fordert man einen
// Laengenbereich, der breiter ist als der Hoehenbereich, blaest MapKit auf
// einem Hochkant-Bildschirm die Hoehe auf, bis die Breite hineinpasst — aus
// 50 km wurden so ueber 100 km. Deshalb rechnen wir das Seitenverhaeltnis
// des Kartencontainers gleich mit.
const START_RADIUS_KM = 25
function radiusSpan(mapkit, lat, el) {
  const w = el?.clientWidth || 390
  const h = el?.clientHeight || 844
  const latDelta = (START_RADIUS_KM * 2) / 111
  // Gleiche Strecke in km auf die Breite umgerechnet: erst der
  // Breitengrad-Faktor, dann das Seitenverhaeltnis.
  const kmPerLngDeg = 111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  const lngDelta = ((START_RADIUS_KM * 2 * (w / h)) / kmPerLngDeg)
  return new mapkit.CoordinateSpan(latDelta, lngDelta)
}

function WorldMap() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const annotationsRef = useRef([])
  // Die Nadeln kommen erst nach dem Kartenaufbau; der select-Handler wird aber
  // schon bei der Kartenerzeugung registriert und wuerde sonst auf einem leeren
  // spots-Array festhaengen (stale closure).
  const spotsRef = useRef([])
  const didFitRef = useRef(false)
  // Hat der Nutzer die Karte selbst bewegt (Suche/flyTo)? Dann nicht mehr
  // ungefragt wegspringen.
  const userMovedRef = useRef(false)
  // Der zuletzt bekannte Standort liegt im gemeinsamen Speicher und steht
  // damit schon beim ersten Frame bereit — die Karte geht sofort dort auf,
  // statt erst die Ortung abzuwarten und danach sichtbar hinzufliegen.
  const initialCoordsRef = useRef(getLastKnownLocation())
  const [spots, setSpots] = useState([])
  const [coords, setCoords] = useState(initialCoordsRef.current ?? undefined)
  const [mapReady, setMapReady] = useState(false)
  // MapKit verwirft die Startregion beim ersten Aufbau gelegentlich. Kurz
  // danach schauen wir deshalb noch einmal nach, ob die Karte wirklich dort
  // steht, wo sie stehen soll — dieser Zaehler stoesst die Pruefung an.
  const [regionCheck, setRegionCheck] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  // Spots laden
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await getMyMappedSpots(user?.id)
      if (!cancelled) { spotsRef.current = data; setSpots(data); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  // Frischen Standort nachziehen. undefined = steht noch aus,
  // null = nicht verfuegbar/abgelehnt.
  useEffect(() => {
    let cancelled = false
    const hadCache = !!initialCoordsRef.current
    // Nur ohne gespeicherten Standort muessen wir ueberhaupt warten. Nach 3s
    // zeigen wir dann erstmal die eigenen Spots, statt auf eine offene
    // Berechtigungsabfrage zu warten — trifft der Standort danach doch noch
    // ein, fliegt die Karte hin (siehe Startausschnitt-Effekt).
    const giveUp = hadCache
      ? null
      : setTimeout(() => { if (!cancelled) setCoords((c) => (c === undefined ? null : c)) }, 3000)
    getLocation().then((c) => {
      if (giveUp) clearTimeout(giveUp)
      if (cancelled) return
      if (c) setCoords(c)
      // Ortung fehlgeschlagen: den gespeicherten Standort behalten wir als
      // Ausschnitt, sonst wuerde die Karte mitten in der Sitzung wegspringen.
      else if (!hadCache) setCoords(null)
    })
    return () => { cancelled = true; if (giveUp) clearTimeout(giveUp) }
  }, [])

  // Karte aufbauen — bewusst UNABHAENGIG von den Spots: MapKit-Script, Token
  // und Kartenaufbau sind der teuerste Teil und brauchen die Daten nicht.
  // Frueher lief das erst nach dem Laden der Spots (zwei serielle Phasen).
  useEffect(() => {
    let cancelled = false
    let recheckTimer = null

    ;(async () => {
      try {
        const mapkit = await ensureMapkit()
        if (cancelled || !mapContainerRef.current) return

        const options = {
          colorScheme: isDark ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light,
          mapType: mapkit.Map.MapTypes.Hybrid,
          showsCompass: mapkit.FeatureVisibility.Hidden,
          showsScale: mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          isRotationEnabled: false,
        }

        // Startausschnitt direkt bei der Erzeugung mitgeben, damit die Karte
        // nicht erst einen Frame lang die Weltansicht zeigt.
        const start = initialCoordsRef.current
        const startRegion = start
          ? new mapkit.CoordinateRegion(
              new mapkit.Coordinate(start.lat, start.lng),
              radiusSpan(mapkit, start.lat, mapContainerRef.current)
            )
          : null
        if (startRegion) options.region = startRegion

        const map = new mapkit.Map(mapContainerRef.current, options)
        if (cancelled) { map.destroy(); return }
        mapRef.current = map

        // Die Konstruktor-Option allein reicht nicht verlaesslich — noch einmal
        // direkt setzen, jetzt wo die Karte im Dokument haengt und ihre Groesse
        // kennt (die Spannweite haengt am Seitenverhaeltnis).
        if (startRegion) {
          map.region = startRegion
          didFitRef.current = true
          recheckTimer = setTimeout(() => {
            if (!cancelled) setRegionCheck((n) => n + 1)
          }, 400)
        }

        // Tap auf Nadel → Detail-Sheet
        map.addEventListener('select', (e) => {
          const id = e.annotation?.data?.id
          if (!id) return
          const spot = spotsRef.current.find((x) => x.id === id)
          if (spot) { hapticFeedback.light(); setSelected(spot) }
        })
        map.addEventListener('deselect', () => setSelected(null))

        setMapReady(true)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Karte konnte nicht geladen werden')
      }
    })()

    return () => {
      cancelled = true
      if (recheckTimer) clearTimeout(recheckTimer)
      didFitRef.current = false
      userMovedRef.current = false
      annotationsRef.current = []
      if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null }
      // Muss zurueckgesetzt werden, damit beim Neuaufbau (Theme-Wechsel) der
      // Nadel-Effekt wieder ausgeloest wird — bliebe mapReady auf true, liefe
      // er gegen die bereits zerstoerte Karte und die Nadeln fehlten.
      setMapReady(false)
    }
  }, [isDark])

  // Nadeln setzen, sobald BEIDES da ist (Karte + Spots) — in beliebiger Reihenfolge.
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || loading || !window.mapkit) return
    const mapkit = window.mapkit

    if (annotationsRef.current.length) map.removeAnnotations(annotationsRef.current)

    const annotations = spots.map((s) => {
      const coord = new mapkit.Coordinate(s.latitude, s.longitude)
      const a = new mapkit.MarkerAnnotation(coord, {
        color: '#FF7E42',
        title: s.name || '',
        subtitle: ratingLabel(s),
        clusteringIdentifier: 'spot',
        displayPriority: 1000,
      })
      a.data = { id: s.id }
      return a
    })
    annotationsRef.current = annotations
    if (annotations.length) map.addAnnotations(annotations)
  }, [mapReady, spots, loading])

  // Startausschnitt — bewusst getrennt vom Setzen der Nadeln, damit die Karte
  // schon am richtigen Ort steht, sobald der Standort da ist (auch wenn die
  // Spots noch laden).
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !window.mapkit) return
    const mapkit = window.mapkit

    // Standort da → hin. Das gilt auch, wenn wir zwischenzeitlich schon die
    // Spots gezeigt haben (Berechtigungsdialog beim ersten Mal), solange der
    // Nutzer nicht selbst navigiert hat.
    if (coords && !userMovedRef.current) {
      const span = radiusSpan(mapkit, coords.lat, mapContainerRef.current)
      const region = new mapkit.CoordinateRegion(
        new mapkit.Coordinate(coords.lat, coords.lng),
        span
      )

      // Wichtig: gegen die TATSAECHLICHE Kartenmitte pruefen, nicht gegen das,
      // was wir gesetzt zu haben glauben. MapKit verwirft die Startregion beim
      // ersten Aufbau gelegentlich — verliessen wir uns auf unsere eigene
      // Annahme, bliebe die Karte stumm in der Weltansicht stehen.
      const center = map.center
      const nearTarget =
        center && distanceKm({ lat: center.latitude, lng: center.longitude }, coords) < 1
      // Mitte kann stimmen und der Ausschnitt trotzdem viel zu weit sein.
      const currentSpan = map.region?.span
      const rightZoom = currentSpan && currentSpan.latitudeDelta < span.latitudeDelta * 1.4

      if (nearTarget && rightZoom) { didFitRef.current = true; return }

      const animate = didFitRef.current
      didFitRef.current = true
      if (animate) map.setRegionAnimated(region, true)
      else map.region = region
      return
    }

    if (didFitRef.current) return
    // Standort steht noch aus → kurz warten (max. 3s, siehe oben).
    if (coords === undefined) return

    // Kein Standort: wie bisher auf die eigenen Spots zoomen.
    if (loading) return
    didFitRef.current = true
    if (annotationsRef.current.length) {
      map.showItems(annotationsRef.current, {
        animate: true,
        padding: new mapkit.Padding(80, 40, 120, 40),
      })
    } else {
      // Fallback: Mitteleuropa
      map.region = new mapkit.CoordinateRegion(
        new mapkit.Coordinate(51.0, 10.0),
        new mapkit.CoordinateSpan(8, 8)
      )
    }
  }, [mapReady, coords, loading, spots, regionCheck])

  // Suche
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return spots.filter((s) => (s.name || '').toLowerCase().includes(q)).slice(0, 8)
  }, [query, spots])

  const flyTo = (spot) => {
    const map = mapRef.current
    if (!map || !window.mapkit) return
    userMovedRef.current = true
    hapticFeedback.light()
    setQuery('')
    setSearchOpen(false)
    const coord = new window.mapkit.Coordinate(spot.latitude, spot.longitude)
    map.setRegionAnimated(
      new window.mapkit.CoordinateRegion(coord, new window.mapkit.CoordinateSpan(0.01, 0.01)),
      true
    )
    const ann = annotationsRef.current.find((a) => a.data?.id === spot.id)
    if (ann) map.selectedAnnotation = ann
    setSelected(spot)
  }

  return (
    <div className="fixed inset-0" style={{ background: isDark ? '#0f0f13' : '#f5f5f7' }}>
      {/* Karte */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Kopf: Suche + Schliessen */}
      <div
        className="absolute left-0 right-0 z-20 px-4"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <div className="flex items-center gap-3 max-w-xl mx-auto">
          <div className="flex-1 relative">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Spot suchen…"
              className="w-full px-4 py-3 rounded-2xl outline-none"
              style={{
                background: isDark ? 'rgba(15,15,19,0.85)' : 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(20px) saturate(180%)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                color: isDark ? '#fff' : '#0f0f13',
                fontFamily: "'Poppins', sans-serif", fontSize: 15,
              }}
            />
            {searchOpen && results.length > 0 && (
              <div
                className="absolute left-0 right-0 mt-2 rounded-2xl overflow-hidden"
                style={{
                  background: isDark ? '#1c1c1e' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                  boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
                }}
              >
                {results.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => flyTo(s)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                    style={{ color: isDark ? '#fff' : '#0f0f13', fontFamily: "'Poppins', sans-serif" }}
                  >
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="text-sm flex-shrink-0" style={{ color: '#FF9357' }}>{ratingLabel(s)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => { hapticFeedback.light(); navigate('/account') }}
            onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.9)' }}
            onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            aria-label="Karte schließen"
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: isDark ? 'rgba(15,15,19,0.85)' : 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              transition: 'transform 0.12s ease',
            }}
          >
            <svg className="w-7 h-7" fill="none" stroke={isDark ? '#fff' : '#0f0f13'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Ladezustand / Fehler / leer */}
      {/* Die Karte steht sofort — nur die Nadeln laden noch nach. Daher eine
          dezente Pille statt eines Vollbild-Spinners ueber der Karte. */}
      {loading && (
        <div
          className="absolute left-0 right-0 flex justify-center pointer-events-none z-10"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 78px)' }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: isDark ? 'rgba(15,15,19,0.85)' : 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}
          >
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2" style={{ borderColor: '#FF7E42' }} />
            <span
              className="text-sm"
              style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)', fontFamily: "'Poppins', sans-serif" }}
            >
              Spots werden geladen…
            </span>
          </div>
        </div>
      )}
      {!loading && error && (
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center">
          <p style={{ color: isDark ? '#fff' : '#0f0f13', fontFamily: "'Poppins', sans-serif" }}>{error}</p>
        </div>
      )}
      {!loading && !error && spots.length === 0 && (
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center">
          <div className="text-4xl mb-3">🗺️</div>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', fontFamily: "'Poppins', sans-serif" }}>
            Noch keine Spots mit Standort. Füge Spots mit Ort hinzu – dann erscheinen sie hier auf der Karte.
          </p>
        </div>
      )}

      {/* Detail-Sheet */}
      {selected && (
        <div className="absolute left-0 right-0 z-20 px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
          <div
            className="max-w-xl mx-auto rounded-3xl overflow-hidden"
            style={{
              background: isDark ? '#1c1c1e' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
            }}
          >
            {selected.cover_photo_url && (
              <img
                src={selected.cover_photo_url}
                alt={selected.name}
                height={150}
                decoding="async"
                className="w-full object-cover"
                style={{ height: 150 }}
              />
            )}
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold truncate" style={{ color: isDark ? '#fff' : '#0f0f13', fontFamily: "'Poppins', sans-serif" }}>
                  {selected.name}
                </h3>
                <p className="text-sm truncate" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}>
                  {[selected.category, selected.address].filter(Boolean).join(' · ')}
                </p>
              </div>
              {ratingLabel(selected) && (
                <div
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold"
                  style={{ background: 'rgba(255,126,66,0.15)', color: '#FF7E42', fontFamily: "'Poppins', sans-serif" }}
                >
                  {ratingLabel(selected)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorldMap
