import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { ensureMapkit } from '../lib/mapkit'
import { getMyMappedSpots } from '../services/mySpots'
import { hapticFeedback } from '../utils/haptics'

// Bewertung eines Spots als kurzer Text (Durchschnitt/Overall wie in der App).
function ratingLabel(spot) {
  const v = spot.avg_score ?? spot.rating
  if (v != null) return `★ ${Number(v).toFixed(1)}`
  return ''
}

function WorldMap() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const annotationsRef = useRef([])
  const [spots, setSpots] = useState([])
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
      if (!cancelled) { setSpots(data); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  // Karte initialisieren + Nadeln setzen
  useEffect(() => {
    if (loading) return
    let cancelled = false

    ;(async () => {
      try {
        const mapkit = await ensureMapkit()
        if (cancelled || !mapContainerRef.current) return

        const map = new mapkit.Map(mapContainerRef.current, {
          colorScheme: isDark ? mapkit.Map.ColorSchemes.Dark : mapkit.Map.ColorSchemes.Light,
          mapType: mapkit.Map.MapTypes.Hybrid,
          showsCompass: mapkit.FeatureVisibility.Hidden,
          showsScale: mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          isRotationEnabled: false,
        })
        if (cancelled) { map.destroy(); return }
        mapRef.current = map

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

        // Tap auf Nadel → Detail-Sheet
        map.addEventListener('select', (e) => {
          const id = e.annotation?.data?.id
          if (!id) return
          const spot = spots.find((x) => x.id === id)
          if (spot) { hapticFeedback.light(); setSelected(spot) }
        })
        map.addEventListener('deselect', () => setSelected(null))

        // Auf alle Nadeln zoomen
        if (annotations.length) {
          map.showItems(annotations, {
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
      } catch (e) {
        if (!cancelled) setError(e.message || 'Karte konnte nicht geladen werden')
      }
    })()

    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null }
    }
  }, [loading, spots, isDark])

  // Suche
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return spots.filter((s) => (s.name || '').toLowerCase().includes(q)).slice(0, 8)
  }, [query, spots])

  const flyTo = (spot) => {
    const map = mapRef.current
    if (!map || !window.mapkit) return
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

      {/* Kopf: Zurück + Suche */}
      <div
        className="absolute left-0 right-0 z-20 px-4"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <div className="flex items-center gap-3 max-w-xl mx-auto">
          <button
            onClick={() => navigate('/account')}
            aria-label="Zurück"
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: isDark ? 'rgba(15,15,19,0.85)' : 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke={isDark ? '#fff' : '#0f0f13'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

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
        </div>
      </div>

      {/* Ladezustand / Fehler / leer */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#FF7E42' }} />
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
              <img src={selected.cover_photo_url} alt={selected.name} className="w-full object-cover" style={{ height: 150 }} />
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
