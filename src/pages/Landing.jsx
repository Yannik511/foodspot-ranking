import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Landing() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard')
    }
  }, [user, loading, navigate])

  if (loading) {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Cinematic Food Background with Depth Blur Effect */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1920&q=80")',
          filter: 'blur(0.5px) brightness(1.05)',
        }}
      >
        {/* Cinematic gradient overlay for depth and focus */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/50"></div>
        {/* Soft glow effect */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)',
          }}
        ></div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* App Title at Top Center - Premium Typography */}
        <div className="flex justify-center pt-[10vh] sm:pt-[12vh] md:pt-[14vh] px-4">
          <h1 
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold tracking-tight text-white text-center"
            style={{
              fontFamily: "'Poppins', -apple-system, sans-serif",
              textShadow: '0 4px 30px rgba(0, 0, 0, 0.9), 0 2px 15px rgba(0, 0, 0, 0.7), 0 0 60px rgba(0, 0, 0, 0.4)',
              letterSpacing: '-0.02em',
              fontWeight: '600',
              filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.1))',
            }}
          >
            Foodspot Ranker
          </h1>
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Buttons - Fixed at Bottom Safe Area */}
        <div 
          className="fixed bottom-0 left-0 right-0 px-4 sm:px-6 pb-safe"
          style={{
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
            paddingTop: '1.5rem',
          }}
        >
          <div className="max-w-xl mx-auto grid grid-cols-2 gap-3 sm:gap-4">
            {/* Login Button - Glassmorphism Design */}
            <Link
              to="/login"
              className="relative bg-white/20 backdrop-blur-xl text-white py-4 sm:py-4.5 px-5 sm:px-7 rounded-3xl font-semibold text-base sm:text-lg hover:bg-white/30 active:scale-[0.96] transition-all duration-300 text-center border border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-center overflow-hidden group"
              style={{
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {/* Glassmorphism shine effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative z-10">Login</span>
            </Link>
            
            {/* Sign Up Button - Vibrant Gradient (Coral → Pink) */}
            <Link
              to="/register"
              className="relative bg-gradient-to-r from-[#FF6B6B] via-[#FF8E53] to-[#FF6B9D] text-white py-4 sm:py-4.5 px-5 sm:px-7 rounded-3xl font-semibold text-base sm:text-lg hover:from-[#FF5252] hover:via-[#FF7A3D] hover:to-[#FF5C8D] active:scale-[0.96] transition-all duration-300 text-center shadow-[0_8px_32px_rgba(255,107,107,0.4)] flex items-center justify-center overflow-hidden group"
              style={{
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative z-10">Sign Up</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Landing

