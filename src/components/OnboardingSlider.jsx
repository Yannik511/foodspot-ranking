import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { hapticFeedback } from '../utils/haptics'
import { springEasing } from '../utils/animations'

function OnboardingSlider() {
  const { isDark } = useTheme()
  const [currentPage, setCurrentPage] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const scrollContainerRef = useRef(null)
  const scrollTimeoutRef = useRef(null)
  const isScrollingRef = useRef(false)

  const pages = [
    {
      id: 1,
      icon: (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="4" opacity="0.9" />
          <path d="M50 20L50 50L65 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <circle cx="50" cy="50" r="5" fill="currentColor" opacity="0.9" />
        </svg>
      ),
      title: "Entdecke die besten Orte in deiner Nähe",
      description: "Sobald du den Standort aktivierst, zeigt dir die App automatisch die Top-Bewertungen deiner Stadt.",
      color: "#FF7E42"
    },
    {
      id: 2,
      icon: (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M35 40C35 32 40 25 50 25C60 25 65 32 65 40C65 48 50 60 50 60C50 60 35 48 35 40Z" fill="currentColor" opacity="0.9" />
          <path d="M25 55C25 50 28 45 33 45C38 45 41 50 41 55C41 60 33 68 33 68C33 68 25 60 25 55Z" fill="currentColor" opacity="0.7" />
          <path d="M59 55C59 50 62 45 67 45C72 45 75 50 75 55C75 60 67 68 67 68C67 68 59 60 59 55Z" fill="currentColor" opacity="0.7" />
        </svg>
      ),
      title: "Vergleiche Foodspots deiner Freunde",
      description: "Lass deine Freunde sehen, wo du am liebsten isst – oder finde neue Empfehlungen von echten Genießern.",
      color: "#FF9C68"
    },
    {
      id: 3,
      icon: (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="25" width="60" height="8" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="20" y="40" width="60" height="8" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="20" y="55" width="60" height="8" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="20" y="70" width="45" height="8" rx="2" fill="currentColor" opacity="0.7" />
          <circle cx="75" cy="50" r="12" fill="currentColor" opacity="0.3" />
        </svg>
      ),
      title: "Dein persönlicher Geschmack auf einen Blick",
      description: "Baue Foodspot-Listen, wie du willst – Döner-S-Tier oder Sushi-B-Tier – alles ist möglich.",
      color: "#FFB25A"
    }
  ]

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Präzise Scroll-Erkennung mit besserer Synchronisation
  const handleScroll = () => {
    if (isScrollingRef.current) return
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!scrollContainerRef.current) return

      const scrollLeft = scrollContainerRef.current.scrollLeft
      const containerWidth = scrollContainerRef.current.clientWidth
      const pageIndex = Math.round(scrollLeft / containerWidth)
      
      if (pageIndex !== currentPage && pageIndex >= 0 && pageIndex < pages.length) {
        setCurrentPage(pageIndex)
        hapticFeedback.light()
      }
      
      isScrollingRef.current = false
    }, 50)
  }

  // Scroll to specific page - präzise und smooth
  const scrollToPage = (index) => {
    if (!scrollContainerRef.current || isScrollingRef.current) return
    
    isScrollingRef.current = true
    const containerWidth = scrollContainerRef.current.clientWidth
    
    scrollContainerRef.current.scrollTo({
      left: index * containerWidth,
      behavior: 'smooth'
    })
    
    hapticFeedback.light()
    
    setTimeout(() => {
      isScrollingRef.current = false
    }, 300)
  }

  return (
    <div className="w-full px-4" style={{ marginTop: 'clamp(32px, 8vw, 40px)', paddingBottom: 'clamp(24px, 6vw, 32px)' }}>
      <div className="max-w-md mx-auto">
        {/* Scrollable Container - fest verankert, wie native Apps */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory',
            overscrollBehavior: 'contain',
            scrollBehavior: 'smooth',
            // Feste Container-Größe für stabiles Layout
            width: '100%',
            position: 'relative',
          }}
        >
          <div 
            className="flex" 
            style={{ 
              width: `${pages.length * 100}%`,
              // Verhindert Verschiebungen
              willChange: 'transform',
            }}
          >
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="flex-shrink-0 snap-start"
                style={{
                  width: `${100 / pages.length}%`,
                  // Feste Breite pro Card - verhindert Verschiebungen
                  minWidth: `${100 / pages.length}%`,
                  maxWidth: `${100 / pages.length}%`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 12px',
                }}
              >
                {/* Card - feste Größe, zentriert */}
                <div
                  className={`bg-white dark:bg-gray-800 rounded-[28px] shadow-xl dark:shadow-2xl`}
                  style={{
                    width: '100%',
                    height: 'clamp(240px, 30vh, 280px)',
                    minHeight: 'clamp(240px, 30vh, 280px)',
                    maxHeight: 'clamp(240px, 30vh, 280px)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 'clamp(28px, 7vw, 36px)',
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(17, 24, 39, 0.98) 100%)'
                      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 250, 245, 0.95) 100%)',
                    boxShadow: isDark
                      ? '0 12px 32px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3)'
                      : '0 12px 32px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08)',
                    opacity: isMounted ? 1 : 0,
                    transform: isMounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                    transition: `opacity 0.5s ${springEasing.default} ${0.1 + index * 0.1}s, transform 0.5s ${springEasing.gentle} ${0.1 + index * 0.1}s`,
                    // Verhindert Verschiebungen beim Scrollen
                    position: 'relative',
                    willChange: 'auto',
                  }}
                >
                  <div className="flex flex-col items-center text-center flex-1 justify-center">
                    {/* Icon */}
                    <div 
                      className="flex-shrink-0 flex items-center justify-center rounded-[24px] mb-6"
                      style={{
                        width: 'clamp(80px, 20vw, 88px)',
                        height: 'clamp(80px, 20vw, 88px)',
                        color: page.color,
                        background: isDark
                          ? `linear-gradient(135deg, ${page.color}25 0%, ${page.color}35 100%)`
                          : `linear-gradient(135deg, ${page.color}20 0%, ${page.color}30 100%)`,
                        boxShadow: isDark
                          ? `0 8px 20px ${page.color}15`
                          : `0 8px 20px ${page.color}20`,
                      }}
                    >
                      <div style={{ width: 'clamp(44px, 11vw, 48px)', height: 'clamp(44px, 11vw, 48px)' }}>
                        {page.icon}
                      </div>
                    </div>

                    {/* Title */}
                    <h4 
                      className="font-bold mb-4 text-gray-900 dark:text-gray-100"
                      style={{ 
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 'clamp(19px, 4.8vw, 21px)',
                        fontWeight: 700,
                        lineHeight: '1.3',
                        letterSpacing: '-0.015em',
                      }}
                    >
                      {page.title}
                    </h4>

                    {/* Subtext */}
                    <p 
                      className="text-gray-600 dark:text-gray-300 leading-relaxed px-2"
                      style={{ 
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 'clamp(14px, 3.5vw, 15px)',
                        fontWeight: 400,
                        lineHeight: '1.65',
                        maxWidth: '95%',
                      }}
                    >
                      {page.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Moderne, minimale Pagination - wie iOS/Android */}
        <div 
          className="flex items-center justify-center gap-1.5 mt-6"
          style={{
            opacity: isMounted ? 1 : 0,
            transition: `opacity 0.4s 0.5s ${springEasing.default}`,
            height: '6px',
          }}
        >
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToPage(index)}
              className="transition-all duration-300"
              style={{
                width: index === currentPage ? '12px' : '3px',
                height: '3px',
                backgroundColor: index === currentPage 
                  ? '#F09859'
                  : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'),
                borderRadius: index === currentPage ? '1.5px' : '50%',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: index === currentPage ? 1 : 0.5,
              }}
              aria-label={`Seite ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}

export default OnboardingSlider
