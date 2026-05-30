import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { hapticFeedback } from '../../utils/haptics'
import { springEasing } from '../../utils/animations'

function Login() {
  const { isDark } = useTheme()
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  // Setze data-page Attribut für CSS (ähnlich wie Landing)
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.setAttribute('data-page', 'login')
    return () => {
      document.body.removeAttribute('data-page')
    }
  }, [])

  // Lade gespeicherte Credentials
  useEffect(() => {
    const savedEmail = localStorage.getItem('foodspot_saved_email')
    const savedRemember = localStorage.getItem('foodspot_remember_me')

    if (savedEmail && savedRemember === 'true') {
      setEmailOrUsername(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let email = emailOrUsername

      if (!emailOrUsername.includes('@')) {
        setError('Bitte gib eine gültige E-Mail-Adresse ein')
        setLoading(false)
        return
      }

      const { data, error } = await signIn(email, password)

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      if (data?.user) {
        if (rememberMe) {
          localStorage.setItem('foodspot_saved_email', emailOrUsername)
          localStorage.setItem('foodspot_remember_me', 'true')
        } else {
          localStorage.removeItem('foodspot_saved_email')
          localStorage.removeItem('foodspot_remember_me')
        }

        hapticFeedback.success()
        navigate('/dashboard')
      }
    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten')
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

  const dividerStyle = {
    height: 1,
    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
    margin: '0 18px',
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
        to="/"
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
          transition: 'transform 0.15s ease',
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

      {/* Scrollable content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 420,
          margin: '0 auto',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        {/* Logo section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <img
            src="/icon.png"
            alt="Rankify"
            style={{
              width: 68,
              height: 68,
              borderRadius: 18,
              boxShadow: '0 8px 28px rgba(255,126,66,0.35)',
              objectFit: 'cover',
              marginBottom: 14,
            }}
          />
          <h1
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              fontSize: 28,
              color: isDark ? '#ffffff' : '#0f0f13',
              margin: 0,
              marginBottom: 6,
            }}
          >
            Rankify
          </h1>
          <p
            style={{
              fontSize: 15,
              color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Willkommen zurück
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* iOS grouped input card */}
          <div style={inputGroupStyle}>
            {/* Email field */}
            <input
              id="emailOrUsername"
              type="email"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              required
              style={inputStyle}
              placeholder="E-Mail"
              autoComplete="email"
            />
            <div style={dividerStyle} />
            {/* Password field */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ ...inputStyle, paddingRight: 52 }}
                placeholder="Passwort"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => {
                  setShowPassword(!showPassword)
                  hapticFeedback.light()
                }}
                style={{
                  position: 'absolute',
                  right: 14,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                  display: 'flex',
                  alignItems: 'center',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
                }}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPassword ? (
                  <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember Me row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 16 }}>
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#FF7E42', cursor: 'pointer', flexShrink: 0 }}
            />
            <label
              htmlFor="rememberMe"
              style={{
                fontSize: 14,
                color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)',
                fontFamily: "'Poppins', sans-serif",
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              E-Mail merken
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 12,
                padding: '12px 16px',
                color: '#EF4444',
                fontSize: 14,
                marginBottom: 16,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {error}
            </div>
          )}

          {/* CTA Button */}
          <button
            type="submit"
            disabled={loading}
            onClick={() => hapticFeedback.medium()}
            onTouchStart={() => hapticFeedback.light()}
            style={{
              width: '100%',
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
            {loading ? 'Wird angemeldet...' : 'Login'}
          </button>
        </form>

        {/* Register link */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p
            style={{
              fontSize: 14,
              color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
              fontFamily: "'Poppins', sans-serif",
              margin: 0,
            }}
          >
            Noch kein Account?{' '}
            <Link
              to="/register"
              style={{
                color: '#FF7E42',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Registrieren
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
