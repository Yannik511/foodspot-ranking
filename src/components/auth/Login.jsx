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
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

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
      // Wenn kein @ enthalten, behandeln wir es als Username
      // Für echten Username-Login müssten wir eine DB-Abfrage machen
      // Für jetzt: Email ist erforderlich - später mit User-Metadata erweitern
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
        // Passwort speichern wenn "Remember Me" aktiviert
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

  return (
    <div 
      className={`min-h-screen flex flex-col p-4 overflow-y-auto ${
        isDark 
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
          : 'bg-gradient-to-br from-orange-50 via-white to-pink-50'
      }`}
      style={{ 
        paddingTop: `max(clamp(3rem, 15vh, 6rem), calc(env(safe-area-inset-top) + clamp(2rem, 12vh, 4rem)))`,
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        minHeight: '100dvh',
      }}
    >
      {/* Back Button - Top Left */}
      <Link
        to="/"
        className={`fixed z-20 w-10 h-10 flex items-center justify-center backdrop-blur-sm rounded-full shadow-lg active:scale-95 transition-all duration-200 ${
          isDark 
            ? 'bg-gray-800/80 hover:bg-gray-700/80' 
            : 'bg-white/80 hover:bg-white'
        }`}
        style={{ 
          top: 'max(1.5rem, calc(env(safe-area-inset-top) + 1.5rem))',
          left: 'max(1.5rem, calc(env(safe-area-inset-left) + 1.5rem))',
        }}
      >
        <svg className={`w-5 h-5 ${isDark ? 'text-gray-200' : 'text-gray-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      <div className="max-w-md w-full mx-auto">
        <div className={`backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 ${
          isDark 
            ? 'bg-gray-800/95 border border-gray-700/50' 
            : 'bg-white/95 border border-white/50'
        }`}>
          {/* Modern Food Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FF6B9D 100%)',
                  boxShadow: '0 8px 24px rgba(255, 107, 107, 0.3)',
                }}
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
          </div>

          {/* Title & Subtext */}
          <div className="text-center mb-8">
            <h1 
              className={`text-3xl md:text-4xl font-bold mb-2 tracking-tight ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Melde dich an
            </h1>
            <p 
              className={`text-base font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Willkommen zurück bei Rankify
            </p>
          </div>

          {error && (
            <div className={`mb-6 p-4 border rounded-xl ${
              isDark 
                ? 'bg-red-900/20 border-red-800' 
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm font-medium ${
                isDark ? 'text-red-300' : 'text-red-800'
              }`}>{error}</p>
            </div>
          )}


          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="emailOrUsername" className={`block text-sm font-semibold mb-2.5 ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                E-Mail
              </label>
              <input
                id="emailOrUsername"
                type="email"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
                className={`w-full px-4 py-3.5 border-2 rounded-xl focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] outline-none transition font-medium shadow-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:bg-gray-700'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:bg-white'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
                placeholder="deine@email.de"
              />
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-semibold mb-2.5 ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full px-4 py-3.5 border-2 rounded-xl focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] outline-none transition font-medium shadow-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:bg-gray-700'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:bg-white'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
                placeholder="••••••••"
              />
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[#FF6B6B] border-gray-300 rounded focus:ring-[#FF6B6B]"
              />
              <label htmlFor="rememberMe" className={`ml-2.5 text-sm font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Passwort speichern
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              onClick={() => hapticFeedback.medium()}
              onTouchStart={() => hapticFeedback.light()}
              className={`w-full py-4 rounded-xl font-semibold text-base active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100 focus:ring-white'
                  : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900'
              }`}
              style={{ 
                fontFamily: "'Poppins', sans-serif",
                transition: `all 0.2s ${springEasing.default}`
              }}
            >
              {loading ? 'Wird angemeldet...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className={`text-sm ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Noch kein Account?{' '}
              <Link to="/register" className="text-[#FF6B6B] hover:text-[#FF5252] font-semibold">
                Jetzt registrieren
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

