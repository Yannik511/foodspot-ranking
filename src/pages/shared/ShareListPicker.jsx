import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'
import { useScrollHeader } from '../../hooks/useScrollHeader'
import { hapticFeedback } from '../../utils/haptics'

const CATEGORY_EMOJIS = {
  'Döner': '🥙',
  'Burger': '🍔',
  'Pizza': '🍕',
  'Asiatisch': '🍜',
  'Bratwurst': '🥓',
  'Glühwein': '🍷',
  'Sushi': '🍣',
  'Steak': '🥩',
  'Fast Food': '🍔',
  'Streetfood': '🌯',
  'Deutsche Küche': '🥨',
  'Bier': '🍺',
  'Leberkässemmel': '🥪',
  'Eis': '🍦',
  'Wein': '🍷',
  'Kaffeebohnen': '☕',
  'Tee': '🍵',
}

export default function ShareListPicker() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const scrollContainerRef = useRef(null)
  const scrolled = useScrollHeader(scrollContainerRef)

  const [loading, setLoading] = useState(true)
  const [lists, setLists] = useState([])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        // 1) Eigene Listen (Owner) — nur die, die bereits geteilt sind
        const { data: ownedLists } = await supabase
          .from('lists')
          .select('id, list_name, city, category, cover_image_url, user_id, members_can_invite')
          .eq('user_id', user.id)

        let sharedOwned = []
        if (ownedLists && ownedLists.length > 0) {
          const ownedIds = ownedLists.map(l => l.id)
          const [{ data: membersData }, { data: pendingData }] = await Promise.all([
            supabase.from('list_members').select('list_id').in('list_id', ownedIds).neq('user_id', user.id),
            supabase.from('list_invitations').select('list_id').in('list_id', ownedIds).eq('status', 'pending'),
          ])
          const sharedIds = new Set([
            ...(membersData || []).map(m => m.list_id),
            ...(pendingData || []).map(i => i.list_id),
          ])
          sharedOwned = ownedLists
            .filter(l => sharedIds.has(l.id))
            .map(l => ({ ...l, role: 'owner' }))
        }

        // 2) Listen, in denen User Editor ist UND members_can_invite = true
        const { data: editorMemberships } = await supabase
          .from('list_members')
          .select('list_id, role, lists:list_id(id, list_name, city, category, cover_image_url, user_id, members_can_invite)')
          .eq('user_id', user.id)
          .eq('role', 'editor')

        const editorLists = (editorMemberships || [])
          .map(m => m.lists)
          .filter(l => l && l.members_can_invite === true)
          .map(l => ({ ...l, role: 'editor' }))

        // 3) Mergen, Duplikate raus
        const merged = [...sharedOwned, ...editorLists].reduce((acc, l) => {
          if (!acc.find(x => x.id === l.id)) acc.push(l)
          return acc
        }, [])

        setLists(merged)
      } catch (error) {
        console.error('[ShareListPicker] Error loading lists:', error)
        setLists([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const handleSelect = (listId) => {
    hapticFeedback.light()
    navigate(`/share-list/${listId}`)
  }

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: isDark ? '#0f0f13' : '#f5f5f7', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        background: scrolled
          ? (isDark ? 'rgba(15,15,19,0.88)' : 'rgba(245,245,247,0.88)')
          : 'transparent',
        borderBottom: `1px solid ${scrolled ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') : 'transparent'}`,
        boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.08)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent', color: isDark ? '#fff' : '#000',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Poppins', sans-serif", margin: 0 }}>
              Schritt 1 von 2
            </p>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif", margin: 0, lineHeight: 1.2 }}>
              Liste auswählen
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main ref={scrollContainerRef} style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)',
        paddingLeft: 16, paddingRight: 16,
        maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <div style={{ width: 28, height: 28, border: '3px solid', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderTopColor: '#FF7E42', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : lists.length === 0 ? (
          <div style={{
            marginTop: 32,
            borderRadius: 20,
            background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            padding: '40px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif", margin: 0, marginBottom: 6 }}>
              Keine teilbaren Listen
            </h2>
            <p style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: "'Poppins', sans-serif", margin: 0, marginBottom: 20, lineHeight: 1.5 }}>
              Du hast noch keine geteilten Listen, in die du jemanden einladen kannst.
            </p>
            <button
              onClick={() => { hapticFeedback.medium(); navigate('/create-shared-list') }}
              style={{
                padding: '12px 24px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: isDark
                  ? 'linear-gradient(135deg, #FF9357, #B85C2C)'
                  : 'linear-gradient(135deg, #FF7E42, #FFB25A)',
                fontSize: 15, fontWeight: 700, fontFamily: "'Poppins', sans-serif",
                color: '#fff',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 4px 16px rgba(255,126,66,0.35)',
              }}
            >
              Geteilte Liste erstellen
            </button>
          </div>
        ) : (
          <div style={{
            borderRadius: 20,
            background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            overflow: 'hidden',
          }}>
            {lists.map((list, i) => {
              const emoji = list.category && CATEGORY_EMOJIS[list.category] ? CATEGORY_EMOJIS[list.category] : '🍽️'
              return (
                <div key={list.id}>
                  {i > 0 && (
                    <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', marginLeft: 76 }} />
                  )}
                  <button
                    onClick={() => handleSelect(list.id)}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent', textAlign: 'left',
                    }}
                  >
                    {/* Cover / Emoji */}
                    {list.cover_image_url ? (
                      <img
                        src={list.cover_image_url}
                        alt={list.list_name}
                        style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22,
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      }}>
                        {emoji}
                      </div>
                    )}

                    {/* Texts */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif", margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {list.list_name}
                      </p>
                      <p style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: "'Poppins', sans-serif", margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[list.city, list.category].filter(Boolean).join(' · ') || 'Produkt-Liste'}
                      </p>
                    </div>

                    {/* Rolle-Pill */}
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      padding: '4px 8px', borderRadius: 999,
                      background: list.role === 'owner'
                        ? (isDark ? 'rgba(255,147,87,0.18)' : 'rgba(255,126,66,0.12)')
                        : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                      color: list.role === 'owner'
                        ? '#FF7E42'
                        : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)'),
                      fontFamily: "'Poppins', sans-serif",
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      flexShrink: 0,
                    }}>
                      {list.role === 'owner' ? 'Owner' : 'Editor'}
                    </span>

                    {/* Chevron */}
                    <svg width="16" height="16" fill="none" stroke={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
