import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'
import { useScrollHeader } from '../../hooks/useScrollHeader'

export default function EditSpot() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const spotId = searchParams.get('spotId')
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const scrollContainerRef = useRef(null)
  const scrolled = useScrollHeader(scrollContainerRef)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [spot, setSpot] = useState(null)
  const [listOwnerUserId, setListOwnerUserId] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!user || !id || !spotId) return
    const load = async () => {
      try {
        const [{ data: listData }, { data: spotData }, { data: memberData }] = await Promise.all([
          supabase.from('lists').select('user_id, members_can_edit_spots').eq('id', id).single(),
          supabase.from('foodspots').select('*').eq('id', spotId).eq('list_id', id).single(),
          supabase.from('list_members').select('role').eq('list_id', id).eq('user_id', user.id).maybeSingle(),
        ])

        if (!spotData) { navigate(-1); return }

        const isListOwner = listData?.user_id === user.id
        const isMember = !!memberData
        const membersCanEdit = listData?.members_can_edit_spots ?? false

        if (!isListOwner && !(isMember && membersCanEdit)) {
          navigate(-1)
          return
        }

        setSpot(spotData)
        setListOwnerUserId(listData?.user_id ?? null)
        setName(spotData.name || '')
        setDescription(spotData.description || '')
      } catch {
        navigate(-1)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, id, spotId, navigate])

  const isListOwner = listOwnerUserId === user?.id
  const isSpotOwner = spot?.user_id === user?.id
  const canDelete = isListOwner || isSpotOwner

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async () => {
    const newErrors = {}
    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Name muss mindestens 2 Zeichen haben'
    }
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('update_shared_foodspot', {
        p_foodspot_id: spotId,
        p_list_id: id,
        p_name: name.trim(),
        p_description: description.trim() || null,
      })
      if (error) throw error
      showToast('Spot aktualisiert')
      setTimeout(() => navigate(-1), 1000)
    } catch (e) {
      showToast(e?.message || 'Fehler beim Speichern', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('foodspots').delete().eq('id', spotId)
      if (error) throw error
      showToast('Spot gelöscht')
      setTimeout(() => navigate(`/shared/tierlist/${id}`), 1000)
    } catch (e) {
      showToast(e?.message || 'Fehler beim Löschen', 'error')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

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
        borderBottom: `1px solid ${scrolled
          ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')
          : 'transparent'}`,
        boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.08)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
              color: isDark ? '#fff' : '#000',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Poppins', sans-serif" }}>
              Spot bearbeiten
            </p>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif", margin: 0, lineHeight: 1.2 }}>
              {spot?.name}
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main ref={scrollContainerRef} style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 120px)',
        paddingLeft: 16,
        paddingRight: 16,
        maxWidth: 600,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Name */}
        <div style={{
          borderRadius: 20, padding: 20,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 10, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif" }}>
            Name des Spots
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z. B. BLN Döner"
            style={{
              width: '100%', borderRadius: 14, padding: '12px 14px',
              border: `1px solid ${errors.name ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)')}`,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              color: isDark ? '#fff' : '#000', fontSize: 15, outline: 'none',
              fontFamily: "'Poppins', sans-serif", boxSizing: 'border-box',
            }}
          />
          {errors.name && <p style={{ marginTop: 8, fontSize: 13, color: '#EF4444' }}>{errors.name}</p>}
        </div>

        {/* Shared Description */}
        <div style={{
          borderRadius: 20, padding: 20,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif" }}>
            Gemeinsame Beschreibung <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span>
          </label>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontFamily: "'Poppins', sans-serif" }}>
            Für alle Teilnehmer sichtbar — z. B. Adresse, Öffnungszeiten, Tipps.
          </p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Beschreibung, Tipps, Öffnungszeiten…"
            rows={4}
            style={{
              width: '100%', borderRadius: 14, padding: '12px 14px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              color: isDark ? '#fff' : '#000', fontSize: 14,
              resize: 'vertical', outline: 'none',
              fontFamily: "'Poppins', sans-serif", boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Delete Section */}
        {canDelete && (
          <div style={{
            borderRadius: 20, padding: 20,
            background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)',
            border: `1px solid ${isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.14)'}`,
          }}>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  width: '100%', padding: '13px', borderRadius: 14,
                  border: `1.5px solid ${isDark ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.3)'}`,
                  background: 'transparent', cursor: 'pointer',
                  fontSize: 15, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                  color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </svg>
                Spot löschen
              </button>
            ) : (
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#EF4444', fontFamily: "'Poppins', sans-serif", textAlign: 'center' }}>
                  Spot wirklich löschen?
                </p>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', fontFamily: "'Poppins', sans-serif", textAlign: 'center', lineHeight: 1.5 }}>
                  Der Spot wird für alle Mitglieder der Liste entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    style={{
                      flex: 1, padding: '13px', borderRadius: 14,
                      border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
                      background: 'transparent', cursor: 'pointer',
                      fontSize: 14, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                      color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                      WebkitTapHighlightColor: 'transparent',
                      opacity: deleting ? 0.5 : 1,
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      flex: 1, padding: '13px', borderRadius: 14, border: 'none', cursor: 'pointer',
                      background: '#EF4444',
                      fontSize: 14, fontWeight: 700, fontFamily: "'Poppins', sans-serif",
                      color: '#fff', opacity: deleting ? 0.6 : 1,
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                    }}
                  >
                    {deleting ? 'Löschen...' : 'Ja, löschen'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Sticky Buttons */}
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
          disabled={submitting}
          style={{
            flex: 2, padding: '14px', borderRadius: 18, border: 'none', cursor: 'pointer',
            background: isDark
              ? 'linear-gradient(135deg, #FF9357, #B85C2C)'
              : 'linear-gradient(135deg, #FF7E42, #FFB25A)',
            fontSize: 15, fontWeight: 700, fontFamily: "'Poppins', sans-serif",
            color: '#fff', opacity: submitting ? 0.6 : 1,
            WebkitTapHighlightColor: 'transparent',
            boxShadow: '0 4px 16px rgba(255,126,66,0.35)',
          }}
        >
          {submitting ? 'Speichern...' : 'Änderungen speichern'}
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
