import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { hapticFeedback } from '../../utils/haptics'
import { springEasing } from '../../utils/animations'

function ForgotPassword() {
  const { isDark } = useTheme()
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.setAttribute('data-page', 'login')
    return () => document.body.removeAttribute('data-page')
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await resetPassword(email.trim())
      // Bewusst immer Erfolg anzeigen (keine Enumeration, ob die Mail existiert).
      if (error && error.status && error.status >= 500) {
        setError('Etwas ist schiefgelaufen. Bitte versuch es später erneut.')
        setLoading(false)
        return
      }
      hapticFeedback.success()
      setSent(true)
      setLoading(false)
    } catch {
      setError('Etwas ist schiefgelaufen. Bitte versuch es später erneut.')
      setLoading(false)
    }
  }

  const inputGroupStyle = {
    borderRadius: 16,
    overflow: 'hidden',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'}`,
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  }

  const inputStyle = {
    padding: '17px 18px',
    fontSize: 16,
    background: 'transparent',
    border: 'none',
    width: '100%',
    outline: 'none',
    color: isDark ? '#ffffff' : '#0f0f13',
    fontFamily: 'inherit',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        background: isDark ? '#0f0f13' : '#f5f5f7',
        overflowY: 'auto',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          background: 'radial-gradient(circle, rgba(255,126,66,0.15) 0%, transparent 65%)',
          width: 350,
          height: 350,
          top: -80,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Back Button */}
      <Link
        to="/login"
        style={{
          position: 'fixed',
          zIndex: 20,
          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          left: 'calc(env(safe-area-inset-left, 0px) + 16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 20,
          backdropFilter: 'blur(24px) saturate(180%)',
          background: isDark ? 'rgba(15,15,19,0.88)' : 'rgba(255,255,255,0.88)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'}`,
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          textDecoration: 'none',
        }}
      >
        <svg
          style={{ width: 18, height: 18, color: isDark ? '#ffffff' : '#0f0f13' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 420,
          margin: '0 auto',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 100px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>{sent ? '📬' : '🔑'}</div>
          <h1
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              fontSize: 26,
              color: isDark ? '#ffffff' : '#0f0f13',
              margin: 0,
              marginBottom: 8,
            }}
          >
            {sent ? 'Mail unterwegs' : 'Passwort vergessen?'}
          </h1>
          <p
            style={{
              fontSize: 15,
              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
              lineHeight: 1.45,
            }}
          >
            {sent
              ? 'Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Schau auch im Spam-Ordner.'
              : 'Gib deine E-Mail-Adresse ein – wir schicken dir einen Link zum Zurücksetzen deines Passworts.'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <div style={inputGroupStyle}>
              <input
                id="resetEmail"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
                placeholder="E-Mail"
                autoComplete="email"
              />
            </div>

            {error && (
              <div
                style={{
                  background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  color: '#EF4444',
                  fontSize: 14,
                  marginTop: 16,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              onClick={() => hapticFeedback.medium()}
              onTouchStart={() => hapticFeedback.light()}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '17px',
                borderRadius: 16,
                border: 'none',
                background: isDark
                  ? 'linear-gradient(135deg, #FF9357, #B85C2C)'
                  : 'linear-gradient(135deg, #FF7E42, #FFB25A)',
                boxShadow: '0 4px 20px rgba(255,126,66,0.4)',
                color: '#ffffff',
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "'Poppins', sans-serif",
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: `all 0.2s ${springEasing.default}`,
              }}
            >
              {loading ? 'Wird gesendet...' : 'Link senden'}
            </button>
          </form>
        ) : (
          <Link
            to="/login"
            style={{
              display: 'block',
              width: '100%',
              padding: '17px',
              borderRadius: 16,
              textAlign: 'center',
              textDecoration: 'none',
              background: isDark
                ? 'linear-gradient(135deg, #FF9357, #B85C2C)'
                : 'linear-gradient(135deg, #FF7E42, #FFB25A)',
              boxShadow: '0 4px 20px rgba(255,126,66,0.4)',
              color: '#ffffff',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Zurück zum Login
          </Link>
        )}

        {!sent && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Link
              to="/login"
              style={{ color: '#FF7E42', fontWeight: 600, textDecoration: 'none', fontSize: 14, fontFamily: "'Poppins', sans-serif" }}
            >
              Zurück zum Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
