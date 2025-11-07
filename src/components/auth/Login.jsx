import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
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

    // Prüfe ob WebAuthn verfügbar ist (Touch ID / Face ID)
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          setBiometricAvailable(available)
        })
        .catch(() => setBiometricAvailable(false))
    }
  }, [])

  const handleBiometricLogin = async () => {
    if (!biometricAvailable) return
    
    try {
      // WebAuthn Credential Request
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          allowCredentials: [],
          timeout: 60000,
          userVerification: 'required',
        },
      })
      
      // Hier würde man die Credentials mit dem Backend validieren
      // Für jetzt zeigen wir nur eine Info
      alert('Biometrische Anmeldung wird noch implementiert!')
    } catch (err) {
      console.error('Biometric login failed:', err)
    }
  }

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
        
        navigate('/dashboard')
      }
    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 flex items-center justify-center p-4 pb-safe" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      {/* Back Button - Top Left */}
      <Link
        to="/"
        className="fixed top-6 left-6 z-20 w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white active:scale-95 transition-all duration-200"
        style={{ top: 'max(1.5rem, env(safe-area-inset-top))' }}
      >
        <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      <div className="max-w-md w-full mt-16">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-10 border border-white/50">
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
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 tracking-tight"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Melde dich an
            </h1>
            <p 
              className="text-gray-600 text-base font-medium"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Willkommen zurück bei Foodspot Ranker
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Biometrische Anmeldung Button */}
          {biometricAvailable && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              className="w-full mb-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3.5 rounded-xl font-semibold text-base hover:from-blue-600 hover:to-purple-700 active:scale-[0.97] transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Mit Face ID / Touch ID anmelden
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="emailOrUsername" className="block text-sm font-semibold text-gray-700 mb-2.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                E-Mail oder Username
              </label>
              <input
                id="emailOrUsername"
                type="text"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] focus:bg-white outline-none transition text-gray-900 placeholder:text-gray-400 font-medium shadow-sm"
                style={{ fontFamily: "'Poppins', sans-serif" }}
                placeholder="deine@email.de oder username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Passwort
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF6B6B] focus:border-[#FF6B6B] focus:bg-white outline-none transition text-gray-900 placeholder:text-gray-400 font-medium shadow-sm"
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
              <label htmlFor="rememberMe" className="ml-2.5 text-sm font-medium text-gray-700" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Passwort speichern
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-4 rounded-xl font-semibold text-base hover:bg-gray-800 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {loading ? 'Wird angemeldet...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
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

