import { useEffect, useState } from 'react'

function WelcomeCard({ username, onCreateList, isCompact = false, foodEmoji = null }) {
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
    background: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'linear-gradient(145deg, #FF9357 0%, #D67A47 40%, #B85C2C 100%)'
      : 'linear-gradient(145deg, #FFB25A 0%, #FF9C68 40%, #FF7E42 100%)',
    boxShadow: '0 12px 40px rgba(255, 125, 66, 0.35)',
    opacity: isMounted ? 1 : 0,
    transform: isMounted ? 'translateY(0)' : 'translateY(20px)',
    transition: 'opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* App Logo - Platzhalter */}
        <div className="mb-2 w-full flex justify-center items-center -mt-4">
          <div 
            className="relative flex items-center justify-center"
            style={{
              opacity: isMounted ? 1 : 0,
              transform: isMounted ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
              transition: 'opacity 0.6s 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* Logo Container - Responsive Größe */}
            <div 
              className="relative flex items-center justify-center rounded-[16px]"
              style={{
                width: 'clamp(96px, 40%, 128px)',
                height: 'clamp(96px, 40%, 128px)',
                background: 'linear-gradient(135deg, rgba(255, 126, 66, 0.2) 0%, rgba(255, 178, 90, 0.2) 100%)',
                boxShadow: '0 4px 16px rgba(255, 125, 66, 0.15)',
              }}
            >
              {/* Burger Icon - Minimalistisches Logo */}
              <svg 
                width="60%" 
                height="60%" 
                viewBox="0 0 100 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                }}
              >
                {/* Bottom Bun */}
                <ellipse cx="50" cy="70" rx="40" ry="18" fill="white" opacity="0.95" />
                {/* Middle Patty */}
                <ellipse cx="50" cy="50" rx="38" ry="15" fill="white" opacity="0.95" />
                {/* Top Bun */}
                <ellipse cx="50" cy="30" rx="42" ry="20" fill="white" opacity="0.95" />
                {/* Sesame Seeds */}
                <circle cx="35" cy="28" r="3" fill="white" opacity="0.7" />
                <circle cx="50" cy="25" r="3" fill="white" opacity="0.7" />
                <circle cx="65" cy="28" r="3" fill="white" opacity="0.7" />
                </svg>
            </div>
          </div>
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
            transition: 'opacity 0.5s 0.4s, transform 0.5s 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
            transition: 'opacity 0.5s 0.5s, transform 0.5s 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          Finde die besten Foodspots deiner Stadt – bewertet von echten Genießern.
        </p>

        {/* Primary Button */}
        {!isCompact ? (
          <div className="flex justify-center w-full">
            <button
              onClick={() => {
                // Navigate to category selection first
                if (typeof onCreateList === 'function') {
                  // Check if onCreateList is a navigation function
                  const navigate = typeof window !== 'undefined' && window.location?.pathname?.includes('/dashboard')
                  if (navigate) {
                    // We'll handle this in the Dashboard component
                    onCreateList()
                  } else {
                    onCreateList()
                  }
                }
              }}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-3.5 px-8 rounded-[20px] font-semibold text-base active:scale-[0.97] transition-all duration-200 shadow-[0_4px_12px_rgba(255,125,66,0.2)] dark:shadow-[0_6px_20px_rgba(184,92,44,0.3)] flex items-center gap-2 w-fit"
              style={{ 
                fontFamily: "'Poppins', sans-serif", 
                fontWeight: 600,
                fontSize: '16px',
                opacity: isMounted ? 1 : 0,
                transform: isMounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
                transition: 'opacity 0.5s 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.5s 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.97)'
                e.currentTarget.style.boxShadow = '0 0 25px rgba(255, 125, 66, 0.6)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 125, 66, 0.2)'
              }}
            >
              {foodEmoji ? (
                <span className="text-lg">{foodEmoji}</span>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              )}
              Starte deine erste Foodspot-Liste
            </button>
          </div>
        ) : (
          <button
            onClick={onCreateList}
            className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-3 rounded-xl font-semibold text-sm hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] active:scale-[0.97] transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 mt-2"
            style={{ 
              fontFamily: "'Poppins', sans-serif", 
              fontWeight: 600,
              fontSize: '16px',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.97)'
              e.currentTarget.style.boxShadow = '0 0 25px rgba(234, 88, 12, 0.6)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
            }}
          >
            {foodEmoji ? (
              <span className="text-base">{foodEmoji}</span>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Erstelle eine neue Liste
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
