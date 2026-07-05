import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import UserAvatar from '../../components/social/UserAvatar'
import { supabase } from '../../services/supabase'
import { useScrollHeader } from '../../hooks/useScrollHeader'
import { hapticFeedback } from '../../utils/haptics'

const getUsername = (u) =>
  u?.user_metadata?.username || u?.username || u?.email?.split('@')[0] || 'Unbekannt'

export default function ShareListInvite() {
  const { id } = useParams()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const scrollContainerRef = useRef(null)
  const scrolled = useScrollHeader(scrollContainerRef)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [list, setList] = useState(null)
  const [canInvite, setCanInvite] = useState(false)
  const [friends, setFriends] = useState([])
  const [unavailableIds, setUnavailableIds] = useState(new Set()) // bereits Member oder pending
  const [selected, setSelected] = useState(new Set())
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!user || !id) return
    const load = async () => {
      setLoading(true)
      try {
        // 1) Liste laden + Berechtigung prüfen
        const { data: listData, error: listError } = await supabase
          .from('lists')
          .select('id, list_name, city, category, cover_image_url, user_id, members_can_invite')
          .eq('id', id)
          .single()

        if (listError || !listData) {
          navigate(-1)
          return
        }

        const isOwner = listData.user_id === user.id
        let editorCanInvite = false

        if (!isOwner) {
          const { data: memberRow } = await supabase
            .from('list_members')
            .select('role')
            .eq('list_id', id)
            .eq('user_id', user.id)
            .maybeSingle()

          editorCanInvite = memberRow?.role === 'editor' && listData.members_can_invite === true
        }

        const allowed = isOwner || editorCanInvite
        if (!allowed) {
          navigate(-1)
          return
        }

        setList(listData)
        setCanInvite(true)

        // 2) Bestehende Members + pending invitations für Liste — ausschließen
        const [{ data: members }, { data: pending }] = await Promise.all([
          supabase.from('list_members').select('user_id').eq('list_id', id),
          supabase.from('list_invitations').select('invitee_id').eq('list_id', id).eq('status', 'pending'),
        ])

        const blocked = new Set([
          ...(members || []).map(m => m.user_id),
          ...(pending || []).map(p => p.invitee_id),
          listData.user_id, // Owner ist immer "drin"
        ])
        setUnavailableIds(blocked)

        // 3) Freunde laden
        const { data: friendships } = await supabase
          .from('friendships')
          .select('requester_id, addressee_id')
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
          .eq('status', 'accepted')

        const friendIds = (friendships || []).map(f =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id
        )

        if (friendIds.length === 0) {
          setFriends([])
          return
        }

        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, email, profile_image_url')
          .in('id', friendIds)

        const mapped = (profiles || []).map(p => ({
          id: p.id,
          email: p.email,
          username: p.username,
          user_metadata: {
            username: p.username || p.email?.split('@')[0] || '',
            profileImageUrl: p.profile_image_url,
          },
        }))

        // Bereits drin = unavailable, aber wir lassen sie trotzdem in der Liste sichtbar (greyed out)
        mapped.sort((a, b) => getUsername(a).localeCompare(getUsername(b)))
        setFriends(mapped)
      } catch (error) {
        console.error('[ShareListInvite] Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, id, navigate])

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return friends
    return friends.filter(f => {
      const u = getUsername(f).toLowerCase()
      return u.includes(q)
    })
  }, [friends, query])

  const toggleSelect = (friendId) => {
    if (unavailableIds.has(friendId)) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(friendId)) next.delete(friendId)
      else next.add(friendId)
      return next
    })
    hapticFeedback.light()
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }

  const handleSubmit = async () => {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)
    try {
      const inviteeIds = Array.from(selected)

      // Serverseitige RPC dedupliziert und prüft Rechte — verhindert doppelte
      // pending-Einladungen (Unique-Constraint), die ein einladendes Mitglied
      // clientseitig nicht erkennen kann (RLS versteckt fremde Einladungen).
      const { data: newCount, error } = await supabase.rpc('send_list_invitations', {
        p_list_id: id,
        p_invitee_ids: inviteeIds,
      })

      if (error) throw error

      const created = newCount ?? 0
      const already = inviteeIds.length - created

      hapticFeedback.success()
      let message
      if (created === inviteeIds.length) {
        message = `${created} ${created === 1 ? 'Einladung' : 'Einladungen'} gesendet`
      } else if (created > 0) {
        message = `${created} gesendet · ${already} bereits eingeladen`
      } else {
        message = 'Bereits eingeladen oder schon Mitglied'
      }
      showToast(message)
      setTimeout(() => navigate('/social'), 800)
    } catch (error) {
      console.error('[ShareListInvite] Error sending invitations:', error)
      hapticFeedback.error()
      showToast(error?.message || 'Fehler beim Senden', 'error')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f0f13' : '#f5f5f7' }}>
        <div style={{ width: 32, height: 32, border: '3px solid', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderTopColor: '#FF7E42', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
      </div>
    )
  }

  if (!list || !canInvite) return null

  const canSubmit = selected.size > 0 && !submitting

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
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Poppins', sans-serif", margin: 0 }}>
              Einladen zu
            </p>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif", margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {list.list_name}
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main ref={scrollContainerRef} style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)',
        paddingLeft: 16, paddingRight: 16,
        maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* Search */}
        <div style={{
          position: 'relative',
          borderRadius: 16,
          background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}>
          <svg
            width="18" height="18"
            fill="none" stroke={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Freund:in suchen"
            style={{
              width: '100%',
              padding: '14px 14px 14px 42px',
              fontSize: 15,
              fontFamily: "'Poppins', sans-serif",
              background: 'transparent',
              border: 'none', outline: 'none',
              color: isDark ? '#fff' : '#000',
              borderRadius: 16,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="12" height="12" fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          )}
        </div>

        {/* Friends list */}
        {friends.length === 0 ? (
          <div style={{
            marginTop: 24, padding: '32px 24px', textAlign: 'center',
            borderRadius: 20,
            background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
            <p style={{ fontSize: 14, fontFamily: "'Poppins', sans-serif", color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', margin: 0, lineHeight: 1.5 }}>
              Du hast noch keine Freunde — füge erst welche hinzu.
            </p>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div style={{
            marginTop: 24, padding: '24px', textAlign: 'center',
            borderRadius: 20,
            background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          }}>
            <p style={{ fontSize: 14, fontFamily: "'Poppins', sans-serif", color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)', margin: 0 }}>
              Keine Treffer für „{query}".
            </p>
          </div>
        ) : (
          <div style={{
            borderRadius: 20,
            background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            overflow: 'hidden',
          }}>
            {filteredFriends.map((friend, i) => {
              const isUnavailable = unavailableIds.has(friend.id)
              const isSelected = selected.has(friend.id)
              return (
                <div key={friend.id}>
                  {i > 0 && (
                    <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', marginLeft: 70 }} />
                  )}
                  <button
                    onClick={() => toggleSelect(friend.id)}
                    disabled={isUnavailable}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', border: 'none', background: 'transparent',
                      cursor: isUnavailable ? 'default' : 'pointer',
                      WebkitTapHighlightColor: 'transparent', textAlign: 'left',
                      opacity: isUnavailable ? 0.45 : 1,
                    }}
                  >
                    <UserAvatar user={friend} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif", margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getUsername(friend)}
                      </p>
                      {isUnavailable && (
                        <p style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontFamily: "'Poppins', sans-serif", margin: '2px 0 0' }}>
                          Bereits in der Liste
                        </p>
                      )}
                    </div>

                    {/* Checkbox / Status */}
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isSelected && !isUnavailable
                        ? '#FF7E42'
                        : 'transparent',
                      border: isSelected && !isUnavailable
                        ? 'none'
                        : `2px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)'}`,
                      transition: 'all 0.15s ease',
                    }}>
                      {isSelected && !isUnavailable && (
                        <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Sticky Submit */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: isDark ? 'rgba(15,15,19,0.95)' : 'rgba(245,245,247,0.95)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        padding: `16px 16px env(safe-area-inset-bottom, 16px)`,
      }}>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '14px', borderRadius: 18, border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit
              ? (isDark ? 'linear-gradient(135deg, #FF9357, #B85C2C)' : 'linear-gradient(135deg, #FF7E42, #FFB25A)')
              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
            fontSize: 15, fontWeight: 700, fontFamily: "'Poppins', sans-serif",
            color: canSubmit ? '#fff' : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'),
            boxShadow: canSubmit ? '0 4px 16px rgba(255,126,66,0.35)' : 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          {submitting
            ? 'Wird gesendet...'
            : selected.size === 0
              ? 'Mindestens 1 Freund:in auswählen'
              : `${selected.size} ${selected.size === 1 ? 'Person' : 'Personen'} einladen`}
        </button>
      </div>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
          left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px', borderRadius: 16, zIndex: 100,
          background: toast.type === 'success' ? '#22C55E' : '#EF4444',
          color: '#fff', fontSize: 14, fontWeight: 600,
          fontFamily: "'Poppins', sans-serif",
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
