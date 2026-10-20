import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { hapticFeedback } from '../utils/haptics'
import { FEEDBACK_CATEGORIES, FEEDBACK_MAX_LENGTH, isValidFeedback, sendFeedback } from '../services/feedback'
import { SUPPORT_EMAIL } from '../constants/contact'

// Feedback-Sheet (Einstellungen + Über Rankify): Kategorie wählen, Text schreiben,
// senden → landet in der Tabelle `feedback`. Gleicher Aufbau wie ReportSheet.
function FeedbackSheet({ open, onClose }) {
  const { isDark } = useTheme()
  const { user } = useAuth()
  const [category, setCategory] = useState('idea')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const close = () => {
    if (status === 'sending') return
    onClose()
    // Nach dem Schließen zurücksetzen, damit das nächste Öffnen frisch startet
    if (status === 'sent') {
      setMessage('')
      setCategory('idea')
      setStatus('idle')
    }
    setError('')
  }

  const submit = async () => {
    if (!isValidFeedback(category, message) || status === 'sending' || !user) return
    setStatus('sending')
    setError('')
    const { error: err } = await sendFeedback(user.id, category, message)
    if (err) {
      setStatus('idle')
      setError(
        err.message?.includes('rate limit')
          ? 'Du hast gerade schon einiges geschickt – probier es gleich nochmal.'
          : 'Senden fehlgeschlagen. Bitte versuche es erneut.',
      )
      hapticFeedback.error()
      return
    }
    setStatus('sent')
    hapticFeedback.success()
  }

  const copyMail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      setCopied(true)
      hapticFeedback.light()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Zwischenablage nicht verfügbar — Adresse steht ja sichtbar da
    }
  }

  const text = isDark ? '#fff' : '#0f0f13'
  const muted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
  const field = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const canSend = isValidFeedback(category, message) && status !== 'sending'

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-slide-up"
        style={{
          width: '100%', maxWidth: 440, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: '10px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: isDark ? '#1c1c1e' : '#fff',
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        <div style={{ width: 38, height: 5, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)', margin: '6px auto 14px' }} />

        {status === 'sent' ? (
          <div style={{ textAlign: 'center', padding: '12px 4px 4px' }}>
            <div className="animate-check-pop" style={{ fontSize: 48, lineHeight: 1 }}>🧡</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 12, color: text }}>Danke dir!</div>
            <div style={{ fontSize: 14, marginTop: 6, color: muted, fontFamily: "'Inter', sans-serif", lineHeight: 1.45 }}>
              Dein Feedback ist angekommen. Wir lesen jede Nachricht.
            </div>
            <button
              onClick={close}
              style={{
                width: '100%', marginTop: 20, padding: 15, borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #FF7E42, #FFB25A)', color: '#fff',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Fertig
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, textAlign: 'center', color: text }}>Feedback senden</div>
            <div style={{ fontSize: 13, textAlign: 'center', margin: '4px 0 16px', color: muted }}>
              Was können wir besser machen?
            </div>

            {/* Kategorie */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {FEEDBACK_CATEGORIES.map((c) => {
                const active = c.key === category
                return (
                  <button
                    key={c.key}
                    onClick={() => { hapticFeedback.light(); setCategory(c.key) }}
                    style={{
                      padding: '10px 4px', borderRadius: 14, cursor: 'pointer',
                      border: active ? '2px solid #FF7E42' : '2px solid transparent',
                      background: active ? 'rgba(255,126,66,0.12)' : field,
                      color: text, fontSize: 12, fontWeight: 600,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 20 }} aria-hidden="true">{c.icon}</span>
                    {c.label}
                  </button>
                )
              })}
            </div>

            {/* Nachricht */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, FEEDBACK_MAX_LENGTH))}
              placeholder={category === 'bug' ? 'Was ist passiert und wo?' : 'Schreib uns, was dir auf dem Herzen liegt …'}
              rows={5}
              style={{
                width: '100%', marginTop: 12, padding: 14, borderRadius: 14, border: 'none',
                background: field, color: text, fontSize: 16, resize: 'none', outline: 'none',
                fontFamily: "'Inter', sans-serif", lineHeight: 1.45,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, color: error ? '#EF4444' : muted }}>
              <span>{error}</span>
              <span style={{ color: muted }}>{message.length}/{FEEDBACK_MAX_LENGTH}</span>
            </div>

            <button
              onClick={submit}
              disabled={!canSend}
              style={{
                width: '100%', marginTop: 12, padding: 15, borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #FF7E42, #FFB25A)', color: '#fff',
                fontSize: 15, fontWeight: 600, cursor: canSend ? 'pointer' : 'not-allowed',
                opacity: canSend ? 1 : 0.5,
              }}
            >
              {status === 'sending' ? 'Wird gesendet …' : 'Senden'}
            </button>

            <button
              onClick={copyMail}
              style={{
                width: '100%', marginTop: 10, padding: 8, border: 'none', background: 'transparent',
                color: muted, fontSize: 13, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              }}
            >
              {copied ? 'Adresse kopiert ✓' : <>Lieber per Mail? <span style={{ color: '#FF7E42' }}>{SUPPORT_EMAIL}</span></>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default FeedbackSheet
