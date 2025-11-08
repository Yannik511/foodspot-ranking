import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { hapticFeedback } from '../../utils/haptics'
import { springEasing } from '../../utils/animations'

function Register() {
  const { isDark } = useTheme()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein')
      return
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await signUp(email, password, username)
      
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      if (data?.user) {
        // Automatisch zum Dashboard weiterleiten - User ist bereits eingeloggt
        setSuccess(true)
        hapticFeedback.success()
        setTimeout(() => {
          navigate('/dashboard')
        }, 1000)
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
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
              Erstelle deinen Account
            </h1>
            <p 
              className={`text-base font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Entdecke die besten Foodspots deiner Stadt
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

          {success && (
            <div className={`mb-6 p-4 border rounded-xl ${
              isDark 
                ? 'bg-green-900/20 border-green-800' 
                : 'bg-green-50 border-green-200'
            }`}>
              <p className={`text-sm font-medium ${
                isDark ? 'text-green-300' : 'text-green-800'
              }`}>
                ✓ Account erfolgreich erstellt! Du wirst automatisch eingeloggt...
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className={`block text-sm font-semibold mb-2.5 ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={`w-full px-4 py-3.5 border-2 rounded-xl focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] outline-none transition font-medium shadow-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:bg-gray-700'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:bg-white'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
                placeholder="dein-username"
              />
            </div>

            <div>
              <label htmlFor="email" className={`block text-sm font-semibold mb-2.5 ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                E-Mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                minLength={6}
                className={`w-full px-4 py-3.5 border-2 rounded-xl focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] outline-none transition font-medium shadow-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:bg-gray-700'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:bg-white'
                }`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
                placeholder="Mindestens 6 Zeichen"
              />
              <p className={`mt-2 text-xs font-medium ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>Mindestens 6 Zeichen</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={`block text-sm font-semibold mb-2.5 ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
                Passwort bestätigen
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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

            <button
              type="submit"
              disabled={loading || success}
              onClick={() => hapticFeedback.medium()}
              onTouchStart={() => hapticFeedback.light()}
              className="w-full bg-gradient-to-r from-[#FF6B6B] via-[#FF8E53] to-[#FF6B9D] text-white py-4 rounded-xl font-semibold text-base hover:from-[#FF5252] hover:via-[#FF7A3D] hover:to-[#FF5C8D] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
              style={{ 
                fontFamily: "'Poppins', sans-serif",
                transition: `all 0.2s ${springEasing.default}`
              }}
            >
              {loading ? 'Wird erstellt...' : success ? 'Erfolgreich!' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className={`text-sm ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              Bereits einen Account?{' '}
              <Link to="/login" className="text-[#FF6B6B] hover:text-[#FF5252] font-semibold">
                Jetzt anmelden
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register

