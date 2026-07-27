import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../services/supabase'
import { glassPanelStyle } from '../lib/glass'

// Read-only MapKit-Ansicht: fliegt zu einem Spot-Standort und markiert ihn.
// Teilt sich die MapKit-Ladelogik-Konvention mit dem LocationPickerSheet
// (Token über die swift-worker Edge Function).

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

export default function SpotMapSheet({ isOpen, onClose, spot }) {
  const { isDark } = useTheme()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  // Galerie: bis zu 5 Bilder der kanonischen Gruppe (lazy beim Öffnen)
  const [images, setImages] = useState(() => (spot?.cover_photo_url ? [spot.cover_photo_url] : []))

  const isProduct = typeof spot?.canonical_key === 'string' && spot.canonical_key.startsWith('product|')
  const lat = !isProduct && spot?.latitude != null ? Number(spot.latitude) : null
  const lng = !isProduct && spot?.longitude != null ? Number(spot.longitude) : null
  const hasMap = lat != null && lng != null

  // Galerie-Bilder nachladen
  useEffect(() => {
    if (!isOpen) return
    // sofort mit dem bekannten Repräsentanten-Bild starten (kein Leer-Flash)
    setImages(spot?.cover_photo_url ? [spot.cover_photo_url] : [])
    if (!spot?.canonical_key) return
    let cancelled = false
    supabase.rpc('get_spot_gallery', { p_canonical_key: spot.canonical_key, p_limit: 5 })
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data)) return
        const urls = data.map((r) => r.url).filter(Boolean)
        if (urls.length) setImages(urls)
      })
    return () => { cancelled = true }
  }, [isOpen, spot?.canonical_key, spot?.cover_photo_url])

  useEffect(() => {
    if (!isOpen || lat == null || lng == null) return
    let cancelled = false
    setReady(false); setError(null)

    async function init() {
      try {
        await loadScript()
        if (cancelled || !mapContainerRef.current) return
        if (!mkInitialized) {
          mkInitialized = true
          window.mapkit.init({
            authorizationCallback: async (done) => {
              try { done(await fetchToken()) }
              catch (e) { mkInitialized = false; tokenCache = null; if (!cancelled) setError(e.message) }
            },
            language: 'de',
          })
        }
        const map = new window.mapkit.Map(mapContainerRef.current, {
          colorScheme: isDark ? window.mapkit.Map.ColorSchemes.Dark : window.mapkit.Map.ColorSchemes.Light,
          mapType: window.mapkit.Map.MapTypes.Hybrid,
          showsCompass: window.mapkit.FeatureVisibility.Hidden,
          showsScale: window.mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          showsUserLocationControl: false,
          isRotationEnabled: false,
        })
        if (cancelled) { map.destroy(); return }
        mapRef.current = map

        const coord = new window.mapkit.Coordinate(lat, lng)
        map.region = new window.mapkit.CoordinateRegion(
          coord, new window.mapkit.CoordinateSpan(0.012, 0.012)
        )
        const marker = new window.mapkit.MarkerAnnotation(coord, {
          color: '#FF7E42',
          title: spot?.name || '',
          subtitle: spot?.address || '',
        })
        map.addAnnotation(marker)
        map.setRegionAnimated(
          new window.mapkit.CoordinateRegion(coord, new window.mapkit.CoordinateSpan(0.008, 0.008)),
          true
        )
        setReady(true)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    init()

    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null }
      setReady(false)
    }
  }, [isOpen, lat, lng, isDark, spot?.name, spot?.address])

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[130] animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-slide-up"
        style={{
          width: '100%',
          ...glassPanelStyle(isDark),
          borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        {/* Kopf */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : '#111', fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {spot?.name}
            </p>
            {spot?.address && (
              <p style={{
                margin: '2px 0 0', fontSize: 12.5,
                color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
                fontFamily: "'Poppins', sans-serif",
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', lineHeight: 1.35,
              }}>
                {spot.address}
              </p>
            )}
          </div>
          <button onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* Galerie — bis zu 5 Bilder der Gruppe, horizontal scrollbar */}
        {images.length > 0 && (
          <div style={{
            display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 12px',
            WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory',
          }}>
            {images.map((url, i) => (
              <div key={url + i} style={{
                flexShrink: 0, width: images.length === 1 ? '100%' : '82%',
                height: 200, borderRadius: 16, overflow: 'hidden', scrollSnapAlign: 'center',
                background: isDark ? '#0f0f13' : '#e5e5ea',
              }}>
                <img src={url} alt="" loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}

        {/* Karte — nur wenn Koordinaten vorhanden */}
        {hasMap && (
          <div style={{ position: 'relative', height: images.length > 0 ? '42vh' : '52vh', background: isDark ? '#0f0f13' : '#e5e5ea' }}>
            {!ready && !error && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="w-8 h-8 border-2 border-[#FF9357] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {error && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, textAlign: 'center' }}>
                <span style={{ fontSize: 28 }}>⚠️</span>
                <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', fontFamily: "'Poppins', sans-serif" }}>
                  Karte konnte nicht geladen werden
                </span>
              </div>
            )}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}
      </div>
    </div>
  )
}
