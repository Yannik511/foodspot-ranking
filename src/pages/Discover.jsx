import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import { useHeaderHeight } from '../hooks/useHeaderHeight'
import { glassBarStyle, glassCardStyle } from '../lib/glass'
import { useTabBarActions } from '../contexts/TabBarActionsContext'
import { SkeletonBox } from '../components/ui/Skeleton'
import SpotMapSheet from '../components/SpotMapSheet'
import { calculateTier } from '../lib/categories'
import { getLastKnownLocation, getLocation } from '../utils/geo'

// Tier-Farbcodierung — identisch zum Rest der App
const TIER_COLORS = {
  S: { color: '#E53935', gradient: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)' },
  A: { color: '#FB8C00', gradient: 'linear-gradient(135deg, #FB8C00 0%, #E65100 100%)' },
  B: { color: '#FDD835', gradient: 'linear-gradient(135deg, #FDD835 0%, #F9A825 100%)' },
  C: { color: '#43A047', gradient: 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)' },
  D: { color: '#1E88E5', gradient: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)' },
  E: { color: '#8E24AA', gradient: 'linear-gradient(135deg, #8E24AA 0%, #6A1B9A 100%)' },
}
const tierStyle = (tier) => TIER_COLORS[tier] || { color: '#FF9357', gradient: 'linear-gradient(135deg, #FF9357, #B85C2C)' }

const CATEGORY_EMOJI = {
  'Döner': '🥙', 'Burger': '🍔', 'Pizza': '🍕', 'Asiatisch': '🍜', 'Bratwurst': '🥓',
  'Glühwein': '🍷', 'Sushi': '🍣', 'Deutsche Küche': '🥨', 'Bier': '🍺', 'Steak': '🥩',
  'Fast Food': '🍔', 'Streetfood': '🌯', 'Leberkässemmel': '🥪',
  'Eis': '🍦', 'Wein': '🍷', 'Kaffeebohnen': '☕', 'Tee': '🍵',
}
const CATEGORIES = Object.keys(CATEGORY_EMOJI)
const catEmoji = (c) => CATEGORY_EMOJI[c] || '🍽️'

// Länder für den Land-Filter (Anzeige → ISO-Code)
const COUNTRIES = [
  { code: 'DE', label: '🇩🇪 Deutschland' },
  { code: 'AT', label: '🇦🇹 Österreich' },
  { code: 'CH', label: '🇨🇭 Schweiz' },
  { code: 'ES', label: '🇪🇸 Spanien' },
  { code: 'IT', label: '🇮🇹 Italien' },
  { code: 'FR', label: '🇫🇷 Frankreich' },
  { code: 'GR', label: '🇬🇷 Griechenland' },
  { code: 'NL', label: '🇳🇱 Niederlande' },
  { code: 'GB', label: '🇬🇧 Vereinigtes Königreich' },
  { code: 'US', label: '🇺🇸 USA' },
]

const CARD_W = 158

function formatDistance(km) {
  if (km == null) return null
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

// ---- Spot-Card ----
// variant 'aggregate' → kein Name/Bild des Owners, dafür Anzahl Bewertungen
// variant 'friend'    → Name + Avatar des Freundes
function SpotCard({ spot, isDark, onOpen, variant = 'aggregate' }) {
  const avg = spot.avg_rating != null ? Number(spot.avg_rating) : null
  const tier = avg != null ? calculateTier(avg) : (spot.tier || null)
  const t = tierStyle(tier)
  const ratingText = avg != null ? avg.toFixed(1) : null
  const dist = formatDistance(spot.distance_km)
  // Produktbasiert (z. B. Bier): nur Name/Ø/Anzahl — KEIN Standort, keine Karte
  const isProduct = typeof spot.canonical_key === 'string' && spot.canonical_key.startsWith('product|')
  const location = isProduct ? null : (spot.city || spot.address || null)
  const count = spot.ratings_count != null ? Number(spot.ratings_count) : null
  const hasCoords = !isProduct && spot.latitude != null && spot.longitude != null
  const showImage = spot.cover_photo_url

  return (
    <button
      onClick={() => onOpen(spot)}
      className="active:scale-[0.97] transition-transform"
      style={{
        width: CARD_W, flexShrink: 0, textAlign: 'left', padding: 0,
        ...glassCardStyle(isDark),
        borderRadius: 18, overflow: 'hidden', cursor: (hasCoords || showImage) ? 'pointer' : 'default',
        boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.35)' : '0 4px 16px rgba(0,0,0,0.08)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Cover — Foto nur bei Freunden; sonst Gradient + Emoji */}
      <div style={{ position: 'relative', height: 104, background: t.gradient }}>
        {showImage ? (
          <img src={spot.cover_photo_url} alt={spot.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
            {catEmoji(spot.category)}
          </div>
        )}
        {tier && (
          <div style={{
            position: 'absolute', top: 8, left: 8, width: 26, height: 26, borderRadius: 8,
            background: t.gradient, color: '#fff', fontWeight: 800, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Poppins', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}>{tier}</div>
        )}
        {ratingText && (
          <div style={{
            position: 'absolute', top: 8, right: 8, padding: '3px 8px', borderRadius: 999,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: "'Poppins', sans-serif",
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <span style={{ color: '#FFD54F' }}>★</span>{ratingText}
          </div>
        )}
        {/* Karten-Hinweis, wenn Koordinaten vorhanden */}
        {hasCoords && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8, width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 700, color: isDark ? '#fff' : '#111',
          fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {spot.name}
        </p>
        {/* Standort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <span style={{ fontSize: 12 }}>{catEmoji(spot.category)}</span>
          <span style={{
            fontSize: 11.5, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)',
            fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {location || spot.category || 'Spot'}{dist ? ` · ${dist}` : ''}
          </span>
        </div>

        {/* Footer: Freund (Name+Avatar) ODER Anzahl Bewertungen */}
        {variant === 'friend' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            {spot.owner_avatar ? (
              <img src={spot.owner_avatar} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: isDark ? '#3a3a3c' : '#e5e5ea', color: isDark ? '#fff' : '#555',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
              }}>
                {(spot.owner_username || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <span style={{
              fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
              fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {spot.owner_username || 'Unbekannt'}
            </span>
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', fontFamily: "'Poppins', sans-serif" }}>
            {count != null ? `${count} ${count === 1 ? 'Bewertung' : 'Bewertungen'}` : ''}
          </div>
        )}
      </div>
    </button>
  )
}

function Row({ children }) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 20px 8px', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x proximity' }}>
      {children}
    </div>
  )
}

function SkeletonRow({ isDark }) {
  return (
    <Row>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ width: CARD_W, flexShrink: 0, borderRadius: 18, overflow: 'hidden', background: isDark ? '#1c1c1e' : '#fff' }}>
          <SkeletonBox rounded="0" style={{ width: '100%', height: 104 }} />
          <div style={{ padding: '10px 12px 12px' }}>
            <SkeletonBox style={{ width: '80%', height: 13 }} />
            <SkeletonBox style={{ width: '55%', height: 10, marginTop: 8 }} />
            <SkeletonBox style={{ width: '45%', height: 10, marginTop: 10 }} />
          </div>
        </div>
      ))}
    </Row>
  )
}

function SectionHeader({ title, subtitle, isDark }) {
  return (
    <div style={{ padding: '0 20px', marginBottom: 4 }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: isDark ? '#fff' : '#111', fontFamily: "'Poppins', sans-serif" }}>{title}</h2>
      {subtitle && <p style={{ margin: '2px 0 0', fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', fontFamily: "'Poppins', sans-serif" }}>{subtitle}</p>}
    </div>
  )
}

function EmptyHint({ text, isDark }) {
  return (
    <div style={{
      margin: '0 20px', padding: '18px 16px', borderRadius: 16,
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
      fontFamily: "'Poppins', sans-serif", textAlign: 'center',
    }}>{text}</div>
  )
}

// ---- Filterleiste ----
function FilterBar({ isDark, mode, setMode, cityQuery, setCityQuery, countryCode, setCountryCode, selectedCategory, setCategory }) {
  const chipBase = (active) => ({
    padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
    fontSize: 13, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
    background: active ? 'linear-gradient(135deg, #FF7E42, #FFB25A)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
    color: active ? '#fff' : (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)'),
    WebkitTapHighlightColor: 'transparent', display: 'flex', alignItems: 'center', gap: 5,
  })
  const modes = [
    { key: 'nearby', label: 'In der Nähe' },
    { key: 'city', label: 'Stadt' },
    { key: 'country', label: 'Land' },
    { key: 'world', label: 'Weltweit' },
  ]
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'

  return (
    <div style={{ padding: '4px 0 8px', position: 'relative' }}>
      {/* Standort-Modus + Kategorie-Dropdown-Button in einer Reihe */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px 8px', WebkitOverflowScrolling: 'touch' }}>
        {modes.map((m) => (
          <button key={m.key} onClick={() => setMode(m.key)} style={chipBase(mode === m.key)}>{m.label}</button>
        ))}
      </div>

      {/* Kategorie-Filter — Dropdown (Einfach-Auswahl wie im Dashboard) */}
      <div style={{ padding: '0 20px 8px' }}>
        <select
          value={selectedCategory}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 12, border: 'none', outline: 'none',
            background: inputBg, color: isDark ? '#fff' : '#111',
            fontSize: 16, fontFamily: "'Poppins', sans-serif",
          }}
        >
          <option value="">Alle Kategorien</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Stadt-Eingabe */}
      {mode === 'city' && (
        <div style={{ padding: '0 20px 8px' }}>
          <input
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder="Stadt oder Bundesland, z. B. München"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 12, border: 'none', outline: 'none',
              background: inputBg, color: isDark ? '#fff' : '#111', fontSize: 14, fontFamily: "'Poppins', sans-serif",
            }}
          />
        </div>
      )}

      {/* Land-Auswahl */}
      {mode === 'country' && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px 8px', WebkitOverflowScrolling: 'touch' }}>
          {COUNTRIES.map((c) => (
            <button key={c.code} onClick={() => setCountryCode(c.code)} style={chipBase(countryCode === c.code)}>{c.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Discover() {
  const { isDark } = useTheme()
  const { user } = useAuth()
  const { headerRef, headerHeight } = useHeaderHeight()
  const { setTabBarHidden } = useTabBarActions()

  const [ranked, setRanked] = useState(null)
  const [byCategory, setByCategory] = useState(null)
  const [friends, setFriends] = useState(null)
  const [mapSpot, setMapSpot] = useState(null)

  // Filter-State
  const [mode, setMode] = useState('nearby')
  const [cityQuery, setCityQuery] = useState('')
  const [countryCode, setCountryCode] = useState('DE')
  const [selectedCategories, setSelectedCategories] = useState([])
  // Mit dem zuletzt bekannten Standort vorbelegt, damit "In deiner Naehe"
  // schon beim ersten Laden Koordinaten hat statt einer zweiten Runde.
  const coordsRef = useRef(getLastKnownLocation())
  const cityDebounce = useRef(null)

  // Einfach-Auswahl im UI (wie Dashboard), intern weiter als Array für die Query
  const selectedCategory = selectedCategories[0] || ''
  const setCategory = (c) => setSelectedCategories(c ? [c] : [])

  const loadFeeds = useCallback(async () => {
    setRanked(null); setByCategory(null); setFriends(null)

    const cats = selectedCategories.length ? selectedCategories : null
    const countryCodes = mode === 'country' && countryCode ? [countryCode] : null
    const city = mode === 'city' && cityQuery.trim() ? cityQuery.trim() : null
    const lat = mode === 'nearby' ? coordsRef.current?.lat ?? null : null
    const lng = mode === 'nearby' ? coordsRef.current?.lng ?? null : null

    const [rk, cat, fr] = await Promise.all([
      supabase.rpc('get_discover_ranked', {
        p_lat: lat, p_lng: lng, p_categories: cats, p_country_codes: countryCodes, p_city: city, p_limit: 30, p_radius_km: 25,
      }),
      supabase.rpc('get_discover_top_by_category', {
        p_per_category: 10, p_categories: cats, p_country_codes: countryCodes, p_city: city,
      }),
      // "Neu von Freunden" ist bewusst filter-unabhängig — immer die letzten Freundes-Spots
      supabase.rpc('get_discover_friends_recent', { p_limit: 20 }),
    ])

    setRanked(rk.error ? [] : (rk.data || []))
    setFriends(fr.error ? [] : (fr.data || []))

    if (cat.error || !cat.data) {
      setByCategory([])
    } else {
      const groups = new Map()
      cat.data.forEach((s) => {
        if (!groups.has(s.category)) groups.set(s.category, [])
        groups.get(s.category).push(s)
      })
      setByCategory(
        Array.from(groups.entries())
          .map(([category, spots]) => ({ category, spots }))
          .sort((a, b) => b.spots.length - a.spots.length || a.category.localeCompare(b.category))
      )
    }
  }, [mode, cityQuery, countryCode, selectedCategories])

  // Standort einmalig holen (für Nähe-Modus)
  useEffect(() => {
    if (!user) return
    getLocation().then((c) => {
      // Ortung fehlgeschlagen: einen bereits bekannten Standort behalten wir.
      if (!c && coordsRef.current) return
      coordsRef.current = c
      if (mode === 'nearby') loadFeeds()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Feeds neu laden bei Filteränderung (Stadt-Eingabe entprellt)
  useEffect(() => {
    if (!user) return
    clearTimeout(cityDebounce.current)
    if (mode === 'city') {
      cityDebounce.current = setTimeout(() => loadFeeds(), 400)
    } else {
      loadFeeds()
    }
    return () => clearTimeout(cityDebounce.current)
  }, [user, mode, cityQuery, countryCode, selectedCategories, loadFeeds])

  const openSpot = (spot) => {
    // Produktbasiert → keine Karte, auch wenn zufällig Koordinaten dranhängen
    const isProduct = typeof spot.canonical_key === 'string' && spot.canonical_key.startsWith('product|')
    const hasCoords = !isProduct && spot.latitude != null && spot.longitude != null
    // Detail-Sheet öffnen, wenn es eine Karte ODER Bilder zu zeigen gibt
    if (hasCoords || spot.cover_photo_url) setMapSpot(spot)
  }

  // Tab-Bar ausblenden, solange die Karte offen ist (sonst überlagert sie die Karte)
  useEffect(() => {
    setTabBarHidden(!!mapSpot)
    return () => setTabBarHidden(false)
  }, [mapSpot, setTabBarHidden])

  const rankedTitle =
    mode === 'nearby' ? 'In deiner Nähe' :
    mode === 'city' ? (cityQuery.trim() ? `Top in ${cityQuery.trim()}` : 'Top nach Stadt') :
    mode === 'country' ? `Top in ${COUNTRIES.find((c) => c.code === countryCode)?.label.replace(/^\S+\s/, '') || 'Land'}` :
    'Weltweit beste'

  return (
    <div className="h-full flex flex-col relative overflow-hidden" style={{ background: isDark ? '#0f0f13' : '#f5f5f7' }}>
      {/* Header + Filterleiste */}
      <header
        ref={headerRef}
        className="header-safe fixed top-0 left-0 right-0 z-20"
        style={glassBarStyle(isDark)}
      >
        <div style={{ padding: '10px 20px 4px' }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: isDark ? '#fff' : '#111', fontFamily: "'Poppins', sans-serif" }}>
            Entdecken
          </h1>
        </div>
        <FilterBar
          isDark={isDark} mode={mode} setMode={setMode}
          cityQuery={cityQuery} setCityQuery={setCityQuery}
          countryCode={countryCode} setCountryCode={setCountryCode}
          selectedCategory={selectedCategory} setCategory={setCategory}
        />
      </header>

      {/* Content */}
      <main
        className="absolute inset-0 overflow-y-auto"
        style={{
          paddingTop: headerHeight ? headerHeight + 12 : 'calc(env(safe-area-inset-top, 0px) + 150px)',
          paddingBottom: 'var(--tabbar-clearance)',
          overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* 1) Ranked (modusabhängiger Titel) */}
          <section>
            <SectionHeader title={rankedTitle} isDark={isDark} />
            {ranked === null
              ? <SkeletonRow isDark={isDark} />
              : ranked.length === 0
                ? <EmptyHint text="Hier ist noch nichts. Sobald andere ihre Statistik teilen, tauchen Spots auf." isDark={isDark} />
                : <Row>{ranked.map((s) => <div key={s.spot_id} style={{ scrollSnapAlign: 'start' }}><SpotCard spot={s} isDark={isDark} onOpen={openSpot} variant="aggregate" /></div>)}</Row>}
          </section>

          {/* 2) Top nach Kategorie */}
          <section>
            <SectionHeader title="Top nach Kategorie" subtitle="Die bestbewerteten Spots je Kategorie" isDark={isDark} />
            {byCategory === null
              ? <SkeletonRow isDark={isDark} />
              : byCategory.length === 0
                ? <EmptyHint text="Noch keine bewerteten Spots geteilt." isDark={isDark} />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {byCategory.map(({ category, spots }) => (
                      <div key={category}>
                        <div style={{ padding: '0 20px', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>{catEmoji(category)}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)', fontFamily: "'Poppins', sans-serif" }}>{category}</span>
                        </div>
                        <Row>{spots.map((s) => <div key={s.spot_id} style={{ scrollSnapAlign: 'start' }}><SpotCard spot={s} isDark={isDark} onOpen={openSpot} variant="aggregate" /></div>)}</Row>
                      </div>
                    ))}
                  </div>
                )}
          </section>

          {/* 3) Neu von Freunden */}
          <section>
            <SectionHeader title="Neu von Freunden" subtitle="Zuletzt hinzugefügt aus deinem Freundeskreis" isDark={isDark} />
            {friends === null
              ? <SkeletonRow isDark={isDark} />
              : friends.length === 0
                ? <EmptyHint text="Deine Freunde haben noch nichts geteilt — oder du hast noch keine Freunde hinzugefügt." isDark={isDark} />
                : <Row>{friends.map((s) => <div key={s.spot_id} style={{ scrollSnapAlign: 'start' }}><SpotCard spot={s} isDark={isDark} onOpen={openSpot} variant="friend" /></div>)}</Row>}
          </section>
        </div>
      </main>

      <SpotMapSheet isOpen={!!mapSpot} spot={mapSpot} onClose={() => setMapSpot(null)} />
    </div>
  )
}
