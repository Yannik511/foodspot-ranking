import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../services/supabase'
import {
  CATEGORIES, CRITERIA_ICONS,
  getCategoryScale, calculateOverallRating, calculateTier
} from '../../lib/categories'
import { useScrollHeader } from '../../hooks/useScrollHeader'

export default function RateSpot() {
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
  const [spot, setSpot] = useState(null)
  const [category, setCategory] = useState(null)
  const [ratings, setRatings] = useState({})
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!user || !id || !spotId) return
    const load = async () => {
      try {
        const [{ data: listData }, { data: spotData }, { data: ratingData }] = await Promise.all([
          supabase.from('lists').select('category, user_id').eq('id', id).single(),
          supabase.from('foodspots').select('*').eq('id', spotId).eq('list_id', id).single(),
          supabase.from('foodspot_ratings')
            .select('score, criteria, comment')
            .eq('foodspot_id', spotId)
            .eq('user_id', user.id)
            .maybeSingle(),
        ])

        if (!spotData) { navigate(-1); return }

        const cat = spotData.category || listData?.category || null
        setSpot(spotData)
        setCategory(cat)

        if (ratingData) {
          setRatings(ratingData.criteria || {})
          setComment(ratingData.comment || '')
        } else if (cat && CATEGORIES[cat]) {
          const init = {}
          CATEGORIES[cat].criteria.forEach(c => { init[c] = 0 })
          setRatings(init)
        }
      } catch {
        navigate(-1)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, id, spotId, navigate])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const overall = calculateOverallRating(ratings, category)
  const tier = calculateTier(overall)

  const handleSave = async () => {
    const filled = Object.values(ratings).filter(r => r > 0)
    if (filled.length < 3) {
      setError('Bitte bewerte mindestens 3 Kriterien')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const { error: rpcError } = await supabase.rpc('update_shared_foodspot', {
        p_foodspot_id: spotId,
        p_list_id: id,
        p_score: overall,
        p_criteria: ratings,
        p_comment: comment.trim() || null,
      })
      if (rpcError) throw rpcError
      showToast('Bewertung gespeichert')
      setTimeout(() => navigate(-1), 1000)
    } catch (e) {
      showToast(e?.message || 'Fehler beim Speichern', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f0f13' : '#f5f5f7' }}>
        <div style={{ width: 32, height: 32, border: '3px solid', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderTopColor: '#FF7E42', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const scale = getCategoryScale(category)
  const criteria = category && CATEGORIES[category] ? CATEGORIES[category].criteria : []

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
              Bewertung
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
        {/* Criteria */}
        {criteria.length > 0 && (
          <div style={{
            borderRadius: 20, padding: '20px',
            background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: "'Poppins', sans-serif", color: isDark ? '#fff' : '#000' }}>
                Bewertungskriterien
              </h3>
              <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
                mind. 3 bewerten
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {criteria.map(criterion => {
                const values = Array.from({ length: scale }, (_, i) => i + 1)
                return (
                  <div key={criterion} style={{
                    borderRadius: 16, border: `1px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{CRITERIA_ICONS[criterion] || '⭐'}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif" }}>{criterion}</span>
                      </div>
                      <span style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>1–{scale}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scale}, 1fr)`, gap: 6 }}>
                      {values.map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setRatings(prev => ({ ...prev, [criterion]: v }))}
                          style={{
                            aspectRatio: '1', borderRadius: 10, border: 'none', cursor: 'pointer',
                            minWidth: 44, minHeight: 44,
                            fontWeight: 700, fontSize: 14,
                            fontFamily: "'Poppins', sans-serif",
                            transition: 'all 0.15s ease',
                            WebkitTapHighlightColor: 'transparent',
                            background: ratings[criterion] >= v
                              ? 'linear-gradient(135deg, #FF9357, #FFB25A)'
                              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                            color: ratings[criterion] >= v
                              ? '#fff'
                              : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'),
                            transform: ratings[criterion] === v ? 'scale(1.08)' : 'scale(1)',
                            boxShadow: ratings[criterion] >= v ? '0 4px 12px rgba(255,147,87,0.35)' : 'none',
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {error && <p style={{ marginTop: 12, fontSize: 13, color: '#EF4444' }}>{error}</p>}
          </div>
        )}

        {/* Overall */}
        {overall > 0 && (
          <div style={{
            borderRadius: 20, padding: '20px 24px',
            background: isDark
              ? 'linear-gradient(135deg, #FF9357, #B85C2C)'
              : 'linear-gradient(135deg, #FF7E42, #FFB25A)',
            color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>⭐ Durchschnitt</p>
              <p style={{ margin: 0, fontSize: 36, fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>{overall.toFixed(1)}/10</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>🏆 Auto-Tier</p>
              <p style={{ margin: 0, fontSize: 56, fontWeight: 700, fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}>{tier}</p>
            </div>
          </div>
        )}

        {/* Comment */}
        <div style={{
          borderRadius: 20, padding: 20,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 10, color: isDark ? '#fff' : '#000', fontFamily: "'Poppins', sans-serif" }}>
            Persönlicher Kommentar <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Was hat dir besonders gefallen oder nicht?"
            rows={3}
            style={{
              width: '100%', borderRadius: 14, padding: '12px 14px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              color: isDark ? '#fff' : '#000',
              fontSize: 14, resize: 'vertical', outline: 'none',
              fontFamily: "'Poppins', sans-serif", boxSizing: 'border-box',
            }}
          />
        </div>
      </main>

      {/* Sticky Buttons */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: isDark ? 'rgba(15,15,19,0.95)' : 'rgba(245,245,247,0.95)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        padding: `16px 16px env(safe-area-inset-bottom, 16px)`,
        display: 'flex', gap: 12,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            flex: 1, padding: '14px', borderRadius: 18, border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
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
          {submitting ? 'Speichern...' : 'Bewertung speichern'}
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
