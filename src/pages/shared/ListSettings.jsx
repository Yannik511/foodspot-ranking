import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'
import { useScrollHeader } from '../../hooks/useScrollHeader'

function Toggle({ value, onChange, isDark }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 51, height: 31, borderRadius: 999, border: 'none',
        cursor: 'pointer', padding: 2,
        background: value ? '#FF7E42' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)'),
        transition: 'background 0.2s ease',
        WebkitTapHighlightColor: 'transparent',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 27, height: 27, borderRadius: '50%', background: '#fff',
        transform: value ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform 0.2s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }} />
    </button>
  )
}

export default function ListSettings() {
  const { id } = useParams()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const scrollContainerRef = useRef(null)
  const scrolled = useScrollHeader(scrollContainerRef)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [listName, setListName] = useState('')
  const [canAddSpots, setCanAddSpots] = useState(false)
  const [canEditSpots, setCanEditSpots] = useState(false)
  const [canEditList, setCanEditList] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!user || !id) return
    const load = async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('list_name, user_id, members_can_add_spots, members_can_edit_spots, members_can_edit_list')
        .eq('id', id)
        .single()

      if (error || !data || data.user_id !== user.id) {
        navigate(-1)
        return
      }

      setListName(data.list_name || '')
      setCanAddSpots(data.members_can_add_spots ?? false)
      setCanEditSpots(data.members_can_edit_spots ?? false)
      setCanEditList(data.members_can_edit_list ?? false)
      setLoading(false)
    }
    load()
  }, [user, id, navigate])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('lists')
        .update({
          members_can_add_spots: canAddSpots,
          members_can_edit_spots: canEditSpots,
          members_can_edit_list: canEditList,
        })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      showToast('Einstellungen gespeichert')
      setTimeout(() => navigate(-1), 1000)
    } catch {
      showToast('Fehler beim Speichern', 'error')
    } finally {
      setSaving(false)
    }
  }

  const PERMISSIONS = [
    {
      key: 'addSpots',
      label: 'Spots hinzufügen',
      description: 'Mitglieder dürfen neue Spots zur Liste hinzufügen.',
      value: canAddSpots,
      onChange: setCanAddSpots,
    },
    {
      key: 'editSpots',
      label: 'Spots bearbeiten',
      description: 'Mitglieder dürfen alle Spots bearbeiten, auch fremde.',
      value: canEditSpots,
      onChange: setCanEditSpots,
    },
    {
      key: 'editList',
      label: 'Liste bearbeiten',
      description: 'Mitglieder dürfen Name, Cover und Beschreibung der Liste ändern.',
      value: canEditList,
      onChange: setCanEditList,
    },
  ]

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f0f13' : '#f5f5f7' }}>
        <div style={{ width: 32, height: 32, border: '3px solid', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderTopColor: '#FF7E42', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
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
              Einstellungen
            </p>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif", margin: 0, lineHeight: 1.2 }}>
              {listName}
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main ref={scrollContainerRef} style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 120px)',
        paddingLeft: 16, paddingRight: 16,
        maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* Info Banner */}
        <div style={{
          borderRadius: 16, padding: '12px 16px',
          background: isDark ? 'rgba(255,147,87,0.1)' : 'rgba(255,126,66,0.08)',
          border: `1px solid ${isDark ? 'rgba(255,147,87,0.2)' : 'rgba(255,126,66,0.2)'}`,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
          <p style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)', fontFamily: "'Poppins', sans-serif", margin: 0, lineHeight: 1.5 }}>
            Bewerten ist für alle Mitglieder immer erlaubt und kann nicht eingeschränkt werden.
          </p>
        </div>

        {/* Permission Toggles */}
        <div style={{
          borderRadius: 20,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          overflow: 'hidden',
        }}>
          {PERMISSIONS.map((perm, i) => (
            <div key={perm.key}>
              {i > 0 && (
                <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', marginLeft: 16 }} />
              )}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, padding: '16px 20px',
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif", margin: 0 }}>
                    {perm.label}
                  </p>
                  <p style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontFamily: "'Poppins', sans-serif", margin: '3px 0 0' }}>
                    {perm.description}
                  </p>
                </div>
                <Toggle value={perm.value} onChange={perm.onChange} isDark={isDark} />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Sticky Save Button */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: isDark ? 'rgba(15,15,19,0.95)' : 'rgba(245,245,247,0.95)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        padding: `16px 16px env(safe-area-inset-bottom, 16px)`,
        display: 'flex', gap: 12,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            flex: 1, padding: '14px', borderRadius: 18,
            border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
            background: 'transparent', cursor: 'pointer',
            fontSize: 15, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
            color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Zurück
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 2, padding: '14px', borderRadius: 18, border: 'none', cursor: 'pointer',
            background: isDark
              ? 'linear-gradient(135deg, #FF9357, #B85C2C)'
              : 'linear-gradient(135deg, #FF7E42, #FFB25A)',
            fontSize: 15, fontWeight: 700, fontFamily: "'Poppins', sans-serif",
            color: '#fff', opacity: saving ? 0.6 : 1,
            WebkitTapHighlightColor: 'transparent',
            boxShadow: '0 4px 16px rgba(255,126,66,0.35)',
          }}
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
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
