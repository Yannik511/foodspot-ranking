import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'

const MAPKIT_CDN = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js'
const MUNICH = { lat: 48.1351, lng: 11.5820 }
const GERMANY = { lat: 51.1657, lng: 10.4515, latSpan: 7.5, lngSpan: 9.0 }

let scriptPromise = null
let mkInitialized = false
let tokenCache = null

async function fetchToken() {
  const now = Math.floor(Date.now() / 1000)
  if (tokenCache && tokenCache.exp > now + 60) return tokenCache.token
  const { data, error } = await supabase.functions.invoke('swift-worker')
  if (error) throw new Error(`Edge Function Fehler: ${error.message}`)
  if (!data?.token) throw new Error(`Kein Token erhalten`)
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
    s.onerror = () => reject(new Error('MapKit JS CDN konnte nicht geladen werden'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

// props:
//   isOpen, onClose, onConfirm, initialCenter
//   returnsName – wenn true, zeigt der Sheet Hinweise zur POI-/Namensauswahl
//   onConfirm({ address, latitude, longitude, name }) – name ist null wenn kein POI/Suche gewählt
export default function LocationPickerSheet({ isOpen, onClose, onConfirm, initialCenter, returnsName = false }) {
  const { isDark } = useTheme()

  const startCenter =
    initialCenter &&
    Number.isFinite(initialCenter.lat) &&
    Number.isFinite(initialCenter.lng)
      ? { lat: initialCenter.lat, lng: initialCenter.lng }
      : MUNICH
  const startRef = useRef(startCenter)
  startRef.current = startCenter

  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const geocoderRef = useRef(null)
  const searchRef = useRef(null)
  const reverseTimer = useRef(null)
  const searchTimer = useRef(null)
  const suppressRegion = useRef(false)
  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark

  const [mapReady, setMapReady] = useState(false)
  const [initError, setInitError] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)
  const [address, setAddress] = useState('')
  const [addressUpdating, setAddressUpdating] = useState(false)
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  // Kartentyp: true = Hybrid (Standard), false = Standard-Karte
  const [isSatellite, setIsSatellite] = useState(true)
  // Name des gewählten POI / Suchergebnisses — null = Crosshair-Modus
  const [pickedName, setPickedName] = useState(null)

  const reverseGeocode = useCallback((lat, lng) => {
    if (!geocoderRef.current) return
    clearTimeout(reverseTimer.current)
    setAddressUpdating(true)
    reverseTimer.current = setTimeout(() => {
      const coord = new window.mapkit.Coordinate(lat, lng)
      geocoderRef.current.reverseLookup(coord, (err, data) => {
        setAddressUpdating(false)
        if (!err && data.results?.[0]) {
          setAddress(data.results[0].formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        }
      })
    }, 600)
  }, [])

  // Placeholder — POI-Tap über MapKit JS tile events ist in Capacitor/WKWebView
  // nicht verfügbar (nativer Layer fängt den Touch ab bevor JS ihn sieht).
  // Name-Befüllung läuft ausschließlich über die Suche (handlePickResult).
  const attachSelectListener = useCallback((_map) => {}, [])

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setInitError(null)
    setMapReady(false)

    async function init() {
      try {
        await loadScript()
        if (cancelled || !mapContainerRef.current) return

        if (!mkInitialized) {
          mkInitialized = true
          window.mapkit.init({
            authorizationCallback: async (done) => {
              try {
                const token = await fetchToken()
                done(token)
              } catch (e) {
                console.error('MapKit auth error:', e)
                mkInitialized = false
                tokenCache = null
                if (!cancelled) setInitError(e.message)
              }
            },
            language: 'de',
          })
        }

        const map = new window.mapkit.Map(mapContainerRef.current, {
          colorScheme: isDarkRef.current
            ? window.mapkit.Map.ColorSchemes.Dark
            : window.mapkit.Map.ColorSchemes.Light,
          mapType: window.mapkit.Map.MapTypes.Hybrid,
          showsCompass: window.mapkit.FeatureVisibility.Hidden,
          showsScale: window.mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          showsUserLocationControl: false,
          isRotationEnabled: false,
          isZoomEnabled: true,
          isScrollEnabled: true,
        })

        if (cancelled) { map.destroy(); return }

        mapRef.current = map
        geocoderRef.current = new window.mapkit.Geocoder({ language: 'de' })
        searchRef.current = new window.mapkit.Search({
          language: 'de',
          getsUserLocation: false,
          includeAddresses: true,
          includePointsOfInterest: true,
          includeQueries: true,
          region: new window.mapkit.CoordinateRegion(
            new window.mapkit.Coordinate(GERMANY.lat, GERMANY.lng),
            new window.mapkit.CoordinateSpan(GERMANY.latSpan, GERMANY.lngSpan)
          ),
        })

        const start = startRef.current
        const center = new window.mapkit.Coordinate(start.lat, start.lng)
        map.region = new window.mapkit.CoordinateRegion(
          center,
          new window.mapkit.CoordinateSpan(0.04, 0.04)
        )

        map.addEventListener('region-change-end', () => {
          if (suppressRegion.current || !mapRef.current) return
          const c = mapRef.current.center
          setCoords({ lat: c.latitude, lng: c.longitude })
          setPickedName(null) // Nutzer hat gescrollt → kein POI-Name mehr
          reverseGeocode(c.latitude, c.longitude)
        })

        attachSelectListener(map)

        setMapReady(true)
        setCoords(start)
        reverseGeocode(start.lat, start.lng)

      } catch (e) {
        console.error('LocationPickerSheet init error:', e)
        if (!cancelled) setInitError(e.message)
      }
    }

    init()

    return () => {
      cancelled = true
      clearTimeout(reverseTimer.current)
      clearTimeout(searchTimer.current)
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
      geocoderRef.current = null
      searchRef.current = null
      suppressRegion.current = false
      setMapReady(false)
      setInitError(null)
      setQuery('')
      setResults([])
      setShowResults(false)
      setSearching(false)
      setAddress('')
      setCoords(null)
      setIsSatellite(true)
      setPickedName(null)
    }
  }, [isOpen, reverseGeocode, attachSelectListener])

  const jumpToCoords = useCallback((lat, lng, label) => {
    if (!mapRef.current) return
    suppressRegion.current = true
    const coord = new window.mapkit.Coordinate(lat, lng)
    mapRef.current.setRegionAnimated(
      new window.mapkit.CoordinateRegion(coord, new window.mapkit.CoordinateSpan(0.01, 0.01))
    )
    setTimeout(() => { suppressRegion.current = false }, 1000)
    setCoords({ lat, lng })
    setAddress(label)
  }, [])

  const doSearch = useCallback((val) => {
    const q = (val || '').trim()
    if (q.length < 2 || !searchRef.current) {
      setResults([])
      setShowResults(false)
      setSearching(false)
      return
    }

    setSearching(true)

    searchRef.current.autocomplete(q, (err, data) => {
      setSearching(false)
      if (err) {
        setResults([])
        setShowResults(false)
        return
      }
      const raw = data?.results || []
      const items = raw.slice(0, 6).map(r => {
        const lines = r.displayLines || []
        return {
          raw: r,
          name: lines[0] || r.completionUrl || '',
          display_name: lines.length ? lines.join(', ') : (lines[0] || ''),
          coordinate: r.coordinate || null,
        }
      }).filter(it => it.name)
      setResults(items)
      setShowResults(items.length > 0)
    })
  }, [])

  const handleQueryChange = (val) => {
    setQuery(val)
    clearTimeout(searchTimer.current)
    if (!val || val.trim().length < 2) {
      setResults([])
      setShowResults(false)
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(() => doSearch(val), 300)
  }

  const handleSearch = () => {
    clearTimeout(searchTimer.current)
    doSearch(query)
  }

  const handlePickResult = (item) => {
    setShowResults(false)
    setSearching(false)
    setQuery(item.name)

    if (item.coordinate) {
      jumpToCoords(item.coordinate.latitude, item.coordinate.longitude, item.display_name)
      setPickedName(item.name)
      return
    }

    if (!searchRef.current) return
    searchRef.current.search(item.raw, (err, data) => {
      if (err) return
      const place = data?.places?.[0]
      if (!place?.coordinate) return
      jumpToCoords(
        place.coordinate.latitude,
        place.coordinate.longitude,
        place.formattedAddress || place.name || item.display_name
      )
      // Aufgelöster Name bevorzugen (z. B. vollständiger Ortsname)
      setPickedName(place.name || item.name)
    })
  }

  const handleGPS = () => {
    if (!navigator.geolocation || !mapRef.current) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        suppressRegion.current = true
        const coord = new window.mapkit.Coordinate(latitude, longitude)
        mapRef.current.setRegionAnimated(
          new window.mapkit.CoordinateRegion(coord, new window.mapkit.CoordinateSpan(0.008, 0.008)),
          true
        )
        setTimeout(() => { suppressRegion.current = false }, 1000)
        setCoords({ lat: latitude, lng: longitude })
        setPickedName(null)
        reverseGeocode(latitude, longitude)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const toggleMapType = () => {
    if (!mapRef.current) return
    const next = !isSatellite
    setIsSatellite(next)
    mapRef.current.mapType = next
      ? window.mapkit.Map.MapTypes.Hybrid
      : window.mapkit.Map.MapTypes.Standard
  }

  const handleRetry = () => {
    mkInitialized = false
    tokenCache = null
    setInitError(null)
    setMapReady(false)
    setPickedName(null)
    if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null }
    ;(async () => {
      try {
        await loadScript()
        if (!mapContainerRef.current) return
        if (!mkInitialized) {
          mkInitialized = true
          window.mapkit.init({
            authorizationCallback: async (done) => {
              try { done(await fetchToken()) }
              catch (e) { mkInitialized = false; tokenCache = null; setInitError(e.message) }
            },
            language: 'de',
          })
        }
        const map = new window.mapkit.Map(mapContainerRef.current, {
          colorScheme: isDark ? window.mapkit.Map.ColorSchemes.Dark : window.mapkit.Map.ColorSchemes.Light,
          mapType: window.mapkit.Map.MapTypes.Hybrid,
          showsCompass: window.mapkit.FeatureVisibility.Hidden,
          showsScale: window.mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false, showsUserLocationControl: false,
          isRotationEnabled: false, isZoomEnabled: true, isScrollEnabled: true,
        })
        mapRef.current = map
        setIsSatellite(true)
        geocoderRef.current = new window.mapkit.Geocoder({ language: 'de' })
        searchRef.current = new window.mapkit.Search({
          language: 'de',
          getsUserLocation: false,
          includeAddresses: true,
          includePointsOfInterest: true,
          includeQueries: true,
          region: new window.mapkit.CoordinateRegion(
            new window.mapkit.Coordinate(GERMANY.lat, GERMANY.lng),
            new window.mapkit.CoordinateSpan(GERMANY.latSpan, GERMANY.lngSpan)
          ),
        })
        const start = startRef.current
        const center = new window.mapkit.Coordinate(start.lat, start.lng)
        map.region = new window.mapkit.CoordinateRegion(center, new window.mapkit.CoordinateSpan(0.04, 0.04))
        map.addEventListener('region-change-end', () => {
          if (suppressRegion.current || !mapRef.current) return
          const c = mapRef.current.center
          setCoords({ lat: c.latitude, lng: c.longitude })
          setPickedName(null)
          reverseGeocode(c.latitude, c.longitude)
        })
        attachSelectListener(map)
        setMapReady(true)
        setCoords(start)
        reverseGeocode(start.lat, start.lng)
      } catch (e) { setInitError(e.message) }
    })()
  }

  const handleConfirm = () => {
    if (!coords) return
    onConfirm({ address, latitude: coords.lat, longitude: coords.lng, name: pickedName || null })
    onClose()
  }

  if (!isOpen) return null

  const panelBg = isDark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.92)'
  const divider = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  const inputBg = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'
  const textPrimary = isDark ? '#fff' : '#000'
  const textSecondary = isDark ? '#888' : '#999'

  return (
    <div className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: isDark ? '#000' : '#fff' }}>

      {/* Header */}
      <div style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 50,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        background: panelBg,
        backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${divider}`,
      }}>
        <div className="flex items-center justify-between px-4 pb-3">
          <button onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={textPrimary} strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6"/>
            </svg>
          </button>

          <span style={{
            fontFamily: "'Poppins', sans-serif", fontWeight: 700,
            fontSize: '17px', color: textPrimary,
          }}>Standort wählen</span>

          <button onClick={handleConfirm}
            disabled={!coords || !!initError}
            className="px-4 h-9 rounded-[11px] text-white text-sm font-semibold active:scale-95 transition-transform disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #FF9357, #B85C2C)', fontFamily: "'Poppins', sans-serif" }}>
            Übernehmen
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3 relative">
          <div className="relative">
            <button
              onClick={handleSearch}
              disabled={!mapReady || !!initError || query.trim().length < 2}
              className="absolute left-3 top-1/2 -translate-y-1/2 disabled:opacity-40 active:scale-90 transition-transform"
            >
              {searching
                ? <div className="w-4 h-4 border-2 border-[#FF9357] border-t-transparent rounded-full animate-spin"/>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke={textSecondary} strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
              }
            </button>
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
              placeholder="Restaurant oder Adresse suchen…"
              disabled={!mapReady || !!initError}
              className="w-full pl-9 pr-8 py-2.5 rounded-[12px] text-sm outline-none disabled:opacity-40"
              style={{ background: inputBg, color: textPrimary, fontFamily: "'Poppins', sans-serif" }}
            />
            {query ? (
              <button
                onClick={() => { setQuery(''); setResults([]); setShowResults(false); setSearching(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={textSecondary} strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
                </svg>
              </button>
            ) : null}
          </div>

          {/* Results dropdown */}
          {showResults && results.length > 0 && (
            <div className="absolute left-4 right-4 top-full z-20 rounded-[16px] overflow-hidden shadow-2xl"
              style={{ background: isDark ? '#1c1c1e' : '#fff', border: `1px solid ${divider}`, marginTop: '4px' }}>
              {results.map((place, i) => {
                const name = place.name || place.display_name?.split(',')[0] || ''
                const subtitle = place.display_name || ''
                return (
                  <button key={i} onClick={() => handlePickResult(place)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 active:opacity-60 transition-opacity"
                    style={{ borderBottom: i < results.length - 1 ? `1px solid ${divider}` : 'none' }}>
                    <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="#FF9357" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate"
                        style={{ color: textPrimary, fontFamily: "'Poppins', sans-serif" }}>
                        {name}
                      </div>
                      {subtitle && subtitle !== name && (
                        <div className="text-xs truncate" style={{ color: textSecondary }}>
                          {subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Map area */}
      <div className="relative flex-1">
        {!mapReady && !initError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10"
            style={{ background: isDark ? '#1c1c1e' : '#e5e5ea' }}>
            <div className="w-8 h-8 border-2 border-[#FF9357] border-t-transparent rounded-full animate-spin mb-3"/>
            <span style={{ color: textSecondary, fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>
              Karte lädt…
            </span>
          </div>
        )}

        {initError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-6"
            style={{ background: isDark ? '#1c1c1e' : '#e5e5ea' }}>
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-center text-sm font-semibold mb-1"
              style={{ color: textPrimary, fontFamily: "'Poppins', sans-serif" }}>
              Karte konnte nicht geladen werden
            </p>
            <p className="text-center text-xs mb-4 px-4"
              style={{ color: textSecondary, fontFamily: "'Poppins', sans-serif" }}>
              {initError}
            </p>
            <button onClick={handleRetry}
              className="px-5 py-2.5 rounded-[12px] text-white text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #FF9357, #B85C2C)', fontFamily: "'Poppins', sans-serif" }}>
              Erneut versuchen
            </button>
          </div>
        )}

        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}/>

        {/* Crosshair-Pin — nur sichtbar wenn kein POI aktiv */}
        {mapReady && !initError && !pickedName && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ paddingBottom: '24px' }}>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg width="36" height="48" viewBox="0 0 36 48" fill="none">
                <path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30S36 30.6 36 18C36 8.06 27.94 0 18 0z" fill="#FF9357"/>
                <circle cx="18" cy="18" r="7" fill="white"/>
              </svg>
              <div style={{
                width: '12px', height: '6px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.3)', filter: 'blur(3px)', marginTop: '-2px',
              }}/>
            </div>
          </div>
        )}

        {/* Karten-Controls — rechts unten, vertikal gestapelt */}
        {mapReady && !initError && (
          <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2"
            style={{ zIndex: 10 }}>
            {/* Satellit-Toggle */}
            <button onClick={toggleMapType}
              className="h-9 rounded-full flex items-center gap-1.5 px-3 shadow-lg active:scale-90 transition-transform"
              style={{ background: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${divider}` }}>
              {isSatellite ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 6l7-3 7 3 7-3v15l-7 3-7-3-7 3V6z"/>
                  <path d="M8 3v15"/>
                  <path d="M15 6v15"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill={textPrimary}>
                  <rect x="2" y="2" width="9" height="9" rx="1.5"/>
                  <rect x="13" y="2" width="9" height="9" rx="1.5"/>
                  <rect x="2" y="13" width="9" height="9" rx="1.5"/>
                  <rect x="13" y="13" width="9" height="9" rx="1.5"/>
                </svg>
              )}
              <span style={{
                fontSize: '12px', fontWeight: 600,
                color: textPrimary, fontFamily: "'Poppins', sans-serif",
              }}>
                {isSatellite ? 'Standard' : 'Satellit'}
              </span>
            </button>
            {/* GPS-Button */}
            <button onClick={handleGPS} disabled={locating}
              className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform disabled:opacity-60"
              style={{ background: isDark ? '#2c2c2e' : '#fff', border: `1px solid ${divider}` }}>
              {locating
                ? <div className="w-4 h-4 border-2 border-[#FF9357] border-t-transparent rounded-full animate-spin"/>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="#FF9357" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                    <circle cx="12" cy="12" r="9" strokeDasharray="2 3"/>
                  </svg>
              }
            </button>
          </div>
        )}
      </div>

      {/* Address / POI-Bar */}
      <div style={{
        flexShrink: 0,
        padding: '14px 16px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        background: panelBg,
        backdropFilter: 'blur(24px)',
        borderTop: `1px solid ${divider}`,
      }}>
        {pickedName ? (
          /* POI / Suchergebnis ausgewählt */
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #FF9357, #B85C2C)' }}>
              {/* Gebäude-Icon für POI */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate" style={{
                fontSize: '15px', fontWeight: 700,
                color: '#FF9357', fontFamily: "'Poppins', sans-serif",
              }}>
                {pickedName}
              </div>
              <div className="truncate" style={{
                fontSize: '12px', color: textSecondary,
                fontFamily: "'Poppins', sans-serif",
                opacity: addressUpdating ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}>
                {address || '…'}
              </div>
            </div>
            {/* Auswahl aufheben → zurück zu Crosshair */}
            <button
              onClick={() => setPickedName(null)}
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
              style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke={textSecondary} strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        ) : (
          /* Crosshair-Modus */
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #FF9357, #B85C2C)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate" style={{
                fontSize: '13px', fontWeight: 600,
                color: textPrimary, fontFamily: "'Poppins', sans-serif",
                opacity: addressUpdating ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }}>
                {initError ? '–' : (address || 'Karte bewegen zum Auswählen')}
              </div>
              {returnsName && !initError && (
                <div style={{ fontSize: '11px', color: textSecondary, fontFamily: "'Poppins', sans-serif", marginTop: '1px' }}>
                  Kein Name — Ort antippen oder suchen
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
