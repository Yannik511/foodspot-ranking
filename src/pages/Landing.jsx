import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hapticFeedback } from '../utils/haptics'
import { springEasing } from '../utils/animations'

function Landing() {
  const { user, loading } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard')
    }
  }, [user, loading, navigate])

  useEffect(() => {
    // Trigger animation after mount with slight delay for smoother entrance
    const timer = setTimeout(() => {
      setIsMounted(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const previousBodyValue = document.body.style.getPropertyValue('--safe-area-bg-current')
    const previousBodyBg = document.body.style.backgroundColor
    document.body.style.setProperty('--safe-area-bg-current', 'transparent')
    // Setze body background auf transparent, damit Safe-Area nicht weiß ist
    document.body.style.backgroundColor = 'transparent'

    return () => {
      if (previousBodyValue) {
        document.body.style.setProperty('--safe-area-bg-current', previousBodyValue)
      } else {
        document.body.style.removeProperty('--safe-area-bg-current')
      }
      // Stelle body background wieder her
      if (previousBodyBg) {
        document.body.style.backgroundColor = previousBodyBg
      } else {
        document.body.style.removeProperty('backgroundColor')
      }
    }
  }, [])

  if (loading) {
    return null
  }

  return (
    <div 
      className="fixed w-full h-full relative overflow-hidden"
      style={{
        position: 'fixed',
        top: `calc(-1 * env(safe-area-inset-top, 0px))`,
        left: `calc(-1 * env(safe-area-inset-left, 0px))`,
        right: `calc(-1 * env(safe-area-inset-right, 0px))`,
        bottom: `calc(-1 * env(safe-area-inset-bottom, 0px))`,
        width: `calc(100vw + env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))`,
        height: `calc(100dvh + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))`,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {/* Burger Background Image - Edge-to-Edge, vollständig abgedeckt inkl. Safe Area */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1920&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          transform: 'scale(1.05)',
          transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          zIndex: 0,
        }}
        onMouseMove={(e) => {
          // Subtiler Parallax-Effekt bei Mausbewegung (nur Desktop)
          if (window.innerWidth > 768) {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            const y = (e.clientY - rect.top) / rect.height
            const moveX = (x - 0.5) * 8
            const moveY = (y - 0.5) * 8
            e.currentTarget.style.transform = `scale(1.05) translate(${moveX}px, ${moveY}px)`
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
      />

      {/* Gradient Overlay - von unten dunkel nach oben transparent + Dark Mode Support */}
      <div 
        className="absolute inset-0"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          background: isDark 
            ? 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0) 100%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)',
          zIndex: 1,
        }}
      />

      {/* Zusätzliche transparente Overlay-Schicht für besseren Textkontrast */}
      <div 
        className="absolute inset-0"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.1)',
          zIndex: 1,
        }}
      />

      {/* Content Container - Edge-to-Edge mit Safe Area, Flexbox-Layout */}
      <div 
        className="relative z-10 w-full h-full flex flex-col"
        style={{
          minHeight: '100%',
          height: '100%',
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)',
          paddingLeft: 'max(env(safe-area-inset-left, 0px), 0px)',
          paddingRight: 'max(env(safe-area-inset-right, 0px), 0px)',
          overflow: 'hidden',
        }}
      >
        {/* Hero-Bereich - Oberes Drittel, mit Safe-Area-Abstand */}
        <div 
          className="flex flex-col items-center justify-center w-full flex-shrink-0"
          style={{
            paddingTop: 'clamp(2rem, 8vh, 4rem)',
            paddingLeft: 'clamp(1rem, 4vw, 2rem)',
            paddingRight: 'clamp(1rem, 4vw, 2rem)',
            minHeight: '33vh',
          }}
        >
          {/* App Title - Rankify - Modern, fett, klare Geometrie, oberes Drittel */}
          <h1 
            className="text-white dark:text-white text-center"
            style={{
              fontFamily: "'Poppins', -apple-system, sans-serif",
              fontSize: 'clamp(3.5rem, 12vw, 6.5rem)',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              lineHeight: '1.1',
              textShadow: isDark 
                ? '0 3px 12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(0, 0, 0, 0.5), 0 6px 16px rgba(0, 0, 0, 0.6)'
                : '0 3px 8px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)',
              marginBottom: 'clamp(1.25rem, 4vh, 2rem)',
              opacity: isMounted ? 1 : 0,
              transform: isMounted ? 'translateY(0)' : 'translateY(-20px)',
              transition: `opacity 0.6s ${springEasing.gentle}, transform 0.6s ${springEasing.gentle}`,
            }}
          >
            Rankify
          </h1>

          {/* Slogan - 🍔 Discover. Rate. Rank. - Deutlich größer, höherer Zeilenabstand */}
          <p
            className="text-center"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(1.25rem, 4.5vw, 2rem)',
              fontWeight: 400,
              color: isDark ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.95)',
              letterSpacing: '0.03em',
              lineHeight: '1.6',
              textShadow: isDark
                ? '0 2px 8px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.6), 0 4px 10px rgba(0, 0, 0, 0.7)'
                : '0 2px 6px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 0, 0, 0.4), 0 3px 8px rgba(0, 0, 0, 0.5)',
              opacity: isMounted ? 1 : 0,
              transform: isMounted ? 'translateY(0)' : 'translateY(-10px)',
              transition: `opacity 0.6s ${springEasing.default} 0.2s, transform 0.6s ${springEasing.gentle} 0.2s`,
            }}
          >
            🍔 Discover. Rate. Rank.
          </p>
        </div>

        {/* Spacer - Flexibler Bereich zwischen Hero und Buttons */}
        <div className="flex-1" />

        {/* Buttons - Unteres Drittel, zentriert, gut mit Daumen erreichbar */}
        <div 
          className="w-full flex flex-col items-center justify-center flex-shrink-0"
          style={{
            width: '100%',
            maxWidth: '420px',
            margin: '0 auto',
            paddingLeft: 'clamp(1.5rem, 5vw, 2rem)',
            paddingRight: 'clamp(1.5rem, 5vw, 2rem)',
            paddingBottom: 'clamp(2.5rem, 8vh, 4rem)',
            gap: 'clamp(1rem, 2.5vh, 1.25rem)',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'translateY(0)' : 'translateY(30px)',
              transition: `opacity 0.4s ${springEasing.default} 0.3s, transform 0.4s ${springEasing.gentle} 0.3s`,
          }}
        >
          {/* Sign Up Button - Modernisiert mit verbesserten Farbverläufen und Schatten */}
          <Link
            to="/register"
            onClick={() => hapticFeedback.medium()}
            onMouseDown={(e) => {
              hapticFeedback.light()
              e.currentTarget.style.transform = 'scale(0.96)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 124, 85, 0.5), 0 6px 16px rgba(255, 77, 109, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 124, 85, 0.4), 0 4px 12px rgba(255, 77, 109, 0.3)'
            }}
            onTouchStart={(e) => {
              hapticFeedback.light()
              e.currentTarget.style.transform = 'scale(0.96)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
            className="w-full bg-gradient-to-r from-[#FF7C55] via-[#FF6B6B] to-[#FF4D6D] text-white dark:text-white py-5 px-8 rounded-[20px] font-semibold text-lg transition-all duration-300 shadow-lg flex items-center justify-center active:scale-96"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              boxShadow: '0 8px 24px rgba(255, 124, 85, 0.4), 0 4px 12px rgba(255, 77, 109, 0.3)',
              minHeight: '56px',
              width: '100%',
            }}
          >
            Sign Up
          </Link>

          {/* Login Button - Modernisiert mit verbessertem Glassmorphism und Dark Mode Support */}
          <Link
            to="/login"
            onClick={() => hapticFeedback.medium()}
            onMouseDown={(e) => {
              hapticFeedback.light()
              e.currentTarget.style.transform = 'scale(0.96)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.4)'
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 0, 0, 0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.35)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            }}
            onTouchStart={(e) => {
              hapticFeedback.light()
              e.currentTarget.style.transform = 'scale(0.96)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
            className="w-full text-white dark:text-white py-5 px-8 rounded-[20px] font-semibold text-lg transition-all duration-300 shadow-lg flex items-center justify-center border-2 border-white/90 dark:border-white/80 backdrop-blur-md active:scale-96"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.35)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
              minHeight: '56px',
              width: '100%',
            }}
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Landing

