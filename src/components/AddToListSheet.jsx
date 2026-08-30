import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { fetchEligibleLists } from '../services/eligibleLists'
import { glassPanelStyle } from '../lib/glass'
import { useDisableSwipeBack } from '../hooks/useDisableSwipeBack'

// Auswahl-Sheet für „Spot aus Entdecken → Liste hinzufügen".
// Zeigt Listen, in die der User den Spot legen darf (Kategorie passt / „Alle
// Kategorien"), graut Listen aus, die den Spot schon enthalten (Dedupe), und
// navigiert bei Auswahl in den passenden Add-Screen mit vorausgefüllten Daten.
export default function AddToListSheet({ isOpen, onClose, spot }) {
  // Solange der Sheet offen ist, darf die Zurueck-Geste nicht wegnavigieren.
  useDisableSwipeBack(isOpen)
  const { isDark } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [lists, setLists] = useState([])

  useEffect(() => {
    if (!isOpen || !spot) return
    let cancelled = false
    setLoading(true)
    fetchEligibleLists({
      userId: user?.id,
      spotCategory: spot.category ?? null,
      canonicalKey: spot.canonical_key ?? null,
    })
      .then((res) => { if (!cancelled) setLists(res) })
      .catch(() => { if (!cancelled) setLists([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, spot, user?.id])

  if (!isOpen || !spot) return null

  const textPrimary = isDark ? '#fff' : '#111'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const handlePick = (list) => {
    if (list.disabled) return
    const params = new URLSearchParams({ prefill: '1' })
    if (spot.name) params.set('name', spot.name)
    if (spot.category) params.set('category', spot.category)
    if (spot.latitude != null && spot.longitude != null) {
      params.set('lat', String(spot.latitude))
      params.set('lng', String(spot.longitude))
    }
    if (spot.address) params.set('address', spot.address)
    if (spot.canonical_key) params.set('ckey', spot.canonical_key)
    const base = list.isShared ? `/shared/add-foodspot/${list.id}` : `/add-foodspot/${list.id}`
    onClose()
    navigate(`${base}?${params.toString()}`)
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[140] animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-slide-up"
        style={{
          width: '100%',
          ...glassPanelStyle(isDark),
          borderTopLeftRadius: 26, borderTopRightRadius: 26,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Kopf */}
        <div style={{ padding: '16px 18px 10px', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: textPrimary, fontFamily: "'Poppins', sans-serif" }}>
            Zu Liste hinzufügen
          </div>
          <div style={{ fontSize: 13, color: textSecondary, fontFamily: "'Poppins', sans-serif", marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {spot.name}
          </div>
        </div>

        {/* Liste */}
        <div style={{ overflowY: 'auto', padding: '0 12px 8px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
              <div className="w-6 h-6 border-2 border-[#FF9357] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : lists.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: textSecondary, fontSize: 14, fontFamily: "'Poppins', sans-serif" }}>
              Keine passende Liste. Erstelle eine Liste der Kategorie „{spot.category || 'passend'}" oder eine Liste für alle Kategorien.
            </div>
          ) : (
            lists.map((list) => (
              <button
                key={list.id}
                onClick={() => handlePick(list)}
                disabled={list.disabled}
                className="w-full text-left flex items-center gap-3 active:opacity-70 transition-opacity"
                style={{
                  padding: '12px 10px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'transparent',
                  opacity: list.disabled ? 0.4 : 1,
                  cursor: list.disabled ? 'default' : 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>
                  {list.cover_image_url
                    ? <img src={list.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '📋'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: textPrimary, fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {list.list_name}
                  </div>
                  <div style={{ fontSize: 12, color: textSecondary, fontFamily: "'Poppins', sans-serif" }}>
                    {(list.category || 'Alle Kategorien')}{list.isShared ? ' · geteilt' : ''}{list.disabled ? ' · schon enthalten' : ''}
                  </div>
                </div>
                {!list.disabled && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ))
          )}
          <div style={{ height: 1, background: divider, margin: '4px 10px 0' }} />
        </div>
      </div>
    </div>
  )
}
