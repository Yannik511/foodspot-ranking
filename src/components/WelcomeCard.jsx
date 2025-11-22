import { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { hapticFeedback } from '../utils/haptics'
import { springEasing } from '../utils/animations'

function WelcomeCard({ username, onCreateList, isCompact = false, foodEmoji = null }) {
  const { isDark } = useTheme()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    // Intro animation on mount
    setIsMounted(true)
  }, [])

  const baseClasses = `relative rounded-[28px] w-full max-w-sm transition-all duration-300 group bg-white dark:bg-gray-900 ${
    isCompact 
      ? 'p-6' 
      : 'p-12 md:p-16'
  }`

  const cardStyle = {
    background: isDark
      ? 'linear-gradient(145deg, #FF9357 0%, #D67A47 40%, #B85C2C 100%)'
      : 'linear-gradient(145deg, #FFB25A 0%, #FF9C68 40%, #FF7E42 100%)',
    boxShadow: '0 12px 40px rgba(255, 125, 66, 0.35)',
    opacity: isMounted ? 1 : 0,
    transform: isMounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.6s ${springEasing.gentle}, transform 0.6s ${springEasing.gentle}`,
  }

  const content = (
    <>
      {/* Subtle Food Pattern Overlay - 5-8% opacity */}
      <div className="absolute inset-0 rounded-[28px] overflow-hidden pointer-events-none">
        <div className="absolute inset-0" style={{ opacity: '0.06' }}>
          <svg className="w-full h-full" fill="none" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
            {/* Geometric Plates */}
            <circle cx="80" cy="100" r="15" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-white/30 dark:text-white/20" />
            <circle cx="250" cy="80" r="12" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-white/30 dark:text-white/20" />
            <circle cx="320" cy="150" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-white/30 dark:text-white/20" />
            
            {/* Cutlery Outlines */}
            <path d="M60 180 L60 230 M55 180 L65 180" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/25 dark:text-white/15" />
            <path d="M120 200 L120 250 M115 200 L125 200" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/25 dark:text-white/15" />
            <path d="M180 190 L180 240 M175 190 L185 190" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/25 dark:text-white/15" />
            
            {/* Dotted Waves */}
            <path d="M40 250 Q70 240, 100 250 T160 250 T220 250" stroke="currentColor" strokeWidth="1" fill="none" className="text-white/20 dark:text-white/10" />
            <path d="M200 260 Q230 250, 260 260 T320 260" stroke="currentColor" strokeWidth="1" fill="none" className="text-white/20 dark:text-white/10" />
            
            {/* Small Dots */}
            <circle cx="150" cy="60" r="2" fill="currentColor" className="text-white/30 dark:text-white/15" />
            <circle cx="280" cy="50" r="2" fill="currentColor" className="text-white/30 dark:text-white/15" />
            <circle cx="90" cy="140" r="2" fill="currentColor" className="text-white/30 dark:text-white/15" />
            <circle cx="350" cy="120" r="2" fill="currentColor" className="text-white/30 dark:text-white/15" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center" style={{ pointerEvents: 'auto' }}>
        {/* App Logo - Rankify Logo - direkt ohne zusätzliche Box */}
        <div className="mb-4 w-full flex justify-center items-center -mt-4">
          <img 
            src="/icon.png" 
            alt="Rankify Logo" 
            style={{
              width: 'clamp(80px, 25vw, 112px)',
              height: 'clamp(80px, 25vw, 112px)',
              objectFit: 'contain',
              display: 'block',
              opacity: isMounted ? 1 : 0,
              transform: isMounted ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
              transition: `opacity 0.6s 0.2s ${springEasing.gentle}, transform 0.6s 0.2s ${springEasing.gentle}`,
            }}
          />
        </div>

        {/* Title - Poppins 700, 22px, white for contrast - closer to image */}
        <h2 
          className={`mb-2 ${isCompact ? 'text-xl' : 'text-[22px]'}`}
          style={{ 
            fontFamily: "'Poppins', sans-serif", 
            fontWeight: 700,
            color: '#FFFFFF',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'translateY(0)' : 'translateY(10px)',
            transition: `opacity 0.5s 0.4s ${springEasing.default}, transform 0.5s 0.4s ${springEasing.gentle}`,
          }}
        >
          {username}'s Foodspot Ranker
        </h2>

        {/* Subtext - Inter 400, 15px, darker for better readability, max 80% width */}
        <p 
          className={`font-normal mb-6 ${isCompact ? 'text-sm' : 'text-[15px]'} max-w-[80%] mx-auto`}
          style={{ 
            fontFamily: "'Inter', sans-serif", 
            fontWeight: 400, 
            color: '#5C5C5C',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'translateY(0)' : 'translateY(10px)',
            transition: `opacity 0.5s 0.5s ${springEasing.default}, transform 0.5s 0.5s ${springEasing.gentle}`,
          }}
        >
          Finde die besten Foodspots deiner Stadt – bewertet von echten Genießern.
        </p>

        {/* Hinweis-Text über dem Button */}
        {!isCompact && (
          <p 
            className="mb-4 max-w-[90%] mx-auto"
            style={{ 
              fontFamily: "'Inter', sans-serif", 
              fontWeight: 500,
              fontSize: 'clamp(16px, 4vw, 18px)',
              lineHeight: '1.5',
              color: '#374151',
              opacity: isMounted ? 1 : 0,
              transform: isMounted ? 'translateY(0)' : 'translateY(10px)',
              transition: `opacity 0.5s 0.55s ${springEasing.default}, transform 0.5s 0.55s ${springEasing.gentle}`,
              marginBottom: 'clamp(16px, 4vw, 20px)',
            }}
          >
            Erstelle jetzt deine erste Liste, um alle Funktionen von Rankify auszuprobieren.
          </p>
        )}

        {/* Primary Button - Größer und prominenter */}
        {!isCompact ? (
          <div className="flex justify-center w-full" style={{ width: '100%', paddingLeft: 'clamp(8px, 2vw, 12px)', paddingRight: 'clamp(8px, 2vw, 12px)' }}>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                hapticFeedback.medium()
                if (typeof onCreateList === 'function') {
                  onCreateList()
                }
              }}
              onTouchStart={() => hapticFeedback.light()}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-[28px] font-bold active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
              style={{ 
                fontFamily: "'Poppins', sans-serif", 
                fontWeight: 700,
                fontSize: 'clamp(20px, 5vw, 24px)',
                paddingTop: 'clamp(28px, 7vw, 34px)',
                paddingBottom: 'clamp(28px, 7vw, 34px)',
                paddingLeft: 'clamp(32px, 8vw, 40px)',
                paddingRight: 'clamp(32px, 8vw, 40px)',
                minHeight: 'clamp(76px, 19vw, 84px)',
                width: '100%',
                maxWidth: '100%',
                opacity: isMounted ? 1 : 0,
                transform: isMounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
                transition: `opacity 0.5s 0.6s ${springEasing.default}, transform 0.5s 0.6s ${springEasing.gentle}`,
                boxShadow: '0 10px 32px rgba(255, 125, 66, 0.35), 0 6px 16px rgba(255, 126, 66, 0.25)',
                pointerEvents: 'auto',
                zIndex: 10,
                position: 'relative',
                lineHeight: '1.4',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.97)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 125, 66, 0.5)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 10px 32px rgba(255, 125, 66, 0.35), 0 6px 16px rgba(255, 126, 66, 0.25)'
              }}
            >
              {foodEmoji ? (
                <span style={{ fontSize: 'clamp(24px, 6vw, 28px)' }}>{foodEmoji}</span>
              ) : (
                <svg 
                  className="flex-shrink-0" 
                  style={{ width: 'clamp(24px, 6vw, 28px)', height: 'clamp(24px, 6vw, 28px)' }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
              )}
              <span>Erstelle jetzt deine erste Liste</span>
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              hapticFeedback.medium()
              if (typeof onCreateList === 'function') {
                onCreateList()
              }
            }}
            onTouchStart={() => hapticFeedback.light()}
            className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-[28px] font-bold active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
            style={{ 
              fontFamily: "'Poppins', sans-serif", 
              fontWeight: 700,
              fontSize: 'clamp(20px, 5vw, 24px)',
              paddingTop: 'clamp(28px, 7vw, 34px)',
              paddingBottom: 'clamp(28px, 7vw, 34px)',
              paddingLeft: 'clamp(32px, 8vw, 40px)',
              paddingRight: 'clamp(32px, 8vw, 40px)',
              minHeight: 'clamp(76px, 19vw, 84px)',
              boxShadow: '0 10px 32px rgba(255, 125, 66, 0.35), 0 6px 16px rgba(255, 126, 66, 0.25)',
              pointerEvents: 'auto',
              zIndex: 10,
              position: 'relative',
              lineHeight: '1.4',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.97)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 125, 66, 0.5)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 10px 32px rgba(255, 125, 66, 0.35), 0 6px 16px rgba(255, 126, 66, 0.25)'
            }}
          >
            {foodEmoji ? (
              <span style={{ fontSize: 'clamp(24px, 6vw, 28px)' }}>{foodEmoji}</span>
            ) : (
              <svg 
                className="flex-shrink-0" 
                style={{ width: 'clamp(24px, 6vw, 28px)', height: 'clamp(24px, 6vw, 28px)' }}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            )}
            <span>Erstelle jetzt deine erste Liste</span>
          </button>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes glowPulse {
          0%, 100% { opacity: 0.2; transform: scale(1.1); }
          50% { opacity: 0.35; transform: scale(1.15); }
        }
      `}</style>
    </>
  )
  
  if (isCompact) {
    return (
      <div className={baseClasses} style={cardStyle}>
        {content}
      </div>
    )
  }
  
  return (
    <div
      className={baseClasses}
      style={cardStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 16px 48px rgba(255, 125, 66, 0.35)'
        e.currentTarget.style.transform = 'translateY(-4px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(255, 125, 66, 0.35)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {content}
    </div>
  )
}

export default WelcomeCard
