import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// Feature Card Component
function FeatureCard({ feature, index, isActive, cardWidth }) {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-lg transition-all duration-300 flex-shrink-0 ${
        isActive ? 'shadow-xl' : ''
      }`}
      style={{
        width: cardWidth,
        maxWidth: cardWidth,
        minWidth: cardWidth,
        boxShadow: isActive 
          ? (isDark 
            ? '0 12px 40px rgba(184, 92, 44, 0.25)' 
            : '0 12px 40px rgba(255, 125, 66, 0.2)')
          : (isDark 
            ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
            : '0 4px 12px rgba(0, 0, 0, 0.08)'),
      }}
    >
      <div 
        className="w-16 h-16 mb-4 mx-auto flex items-center justify-center rounded-[16px] transition-all duration-300"
        style={{
          color: feature.color,
          background: `linear-gradient(135deg, ${feature.color}15 0%, ${feature.color}25 100%)`,
          transform: isActive ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <div className="w-10 h-10">
          {feature.icon}
        </div>
      </div>
      <h4 
        className="font-bold mb-2 text-gray-900 dark:text-gray-100 text-center"
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 'clamp(18px, 4vw, 22px)',
        }}
      >
        {feature.title}
      </h4>
      <p 
        className="text-gray-600 dark:text-gray-300 text-sm text-center leading-relaxed"
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 'clamp(14px, 3vw, 16px)',
        }}
      >
        {feature.description}
      </p>
    </div>
  )
}

function FeaturesSection() {
  const navigate = useNavigate()
  const [isMounted, setIsMounted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showArrow, setShowArrow] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [velocity, setVelocity] = useState(0)
  
  const containerRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const lastTouchXRef = useRef(0)
  const lastTouchTimeRef = useRef(0)
  const animationFrameRef = useRef(null)

  const features = [
    {
      id: 1,
      icon: (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 20L60 40L80 45L65 60L67 80L50 70L33 80L35 60L20 45L40 40L50 20Z" fill="currentColor" opacity="0.9" />
          <circle cx="50" cy="50" r="8" fill="currentColor" opacity="0.6" />
        </svg>
      ),
      title: "Bewerte deine Lieblingsspots",
      description: "Finde und bewerte die besten Döner, Pizzen & Co in deiner Stadt – ehrlich, einfach, persönlich.",
      color: "#FF7E42"
    },
    {
      id: 2,
      icon: (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="25" width="60" height="8" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="20" y="40" width="60" height="8" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="20" y="55" width="60" height="8" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="20" y="70" width="45" height="8" rx="2" fill="currentColor" opacity="0.7" />
          <circle cx="75" cy="50" r="12" fill="currentColor" opacity="0.3" />
        </svg>
      ),
      title: "Erstelle deine eigenen Rankings",
      description: "Baue Foodspot-Listen, wie du willst – Döner-S-Tier oder Sushi-B-Tier – alles ist möglich.",
      color: "#FFB25A"
    },
    {
      id: 3,
      icon: (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="4" opacity="0.9" />
          <path d="M50 20L50 50L65 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <circle cx="50" cy="50" r="5" fill="currentColor" opacity="0.9" />
        </svg>
      ),
      title: "Entdecke die Besten in deiner Nähe",
      description: "Sobald du den Standort aktivierst, zeigt dir die App automatisch die Top-Bewertungen deiner Stadt.",
      color: "#FF9C68"
    },
    {
      id: 4,
      icon: (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M35 40C35 32 40 25 50 25C60 25 65 32 65 40C65 48 50 60 50 60C50 60 35 48 35 40Z" fill="currentColor" opacity="0.9" />
          <path d="M25 55C25 50 28 45 33 45C38 45 41 50 41 55C41 60 33 68 33 68C33 68 25 60 25 55Z" fill="currentColor" opacity="0.7" />
          <path d="M59 55C59 50 62 45 67 45C72 45 75 50 75 55C75 60 67 68 67 68C67 68 59 60 59 55Z" fill="currentColor" opacity="0.7" />
        </svg>
      ),
      title: "Teile & vergleiche mit Freunden",
      description: "Lass deine Freunde sehen, wo du am liebsten isst – oder finde neue Empfehlungen von echten Genießern.",
      color: "#FF7E42"
    },
    {
      id: 5,
      icon: (
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="20" y="60" width="15" height="25" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="40" y="45" width="15" height="40" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="60" y="30" width="15" height="55" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="80" y="50" width="15" height="35" rx="2" fill="currentColor" opacity="0.7" />
          <line x1="15" y1="20" x2="85" y2="20" stroke="currentColor" strokeWidth="2" opacity="0.5" />
          <line x1="15" y1="85" x2="85" y2="85" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        </svg>
      ),
      title: "Dein Geschmack, deine Statistik",
      description: "Verfolge, was du am meisten isst, welche Küche du bevorzugst und wie sich deine Rankings verändern.",
      color: "#FFB25A"
    }
  ]

  // Load saved index from localStorage
  useEffect(() => {
    const savedIndex = localStorage.getItem('featuresSectionLastIndex')
    if (savedIndex !== null) {
      const index = parseInt(savedIndex, 10)
      if (index >= 0 && index < features.length) {
        setCurrentIndex(index)
      }
    }
    setIsMounted(true)
  }, [])

  // Save index to localStorage
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('featuresSectionLastIndex', currentIndex.toString())
    }
  }, [currentIndex, isMounted])

  // Calculate card width (88-92% of screen width)
  const [cardWidth, setCardWidth] = useState(0)
  const [containerPadding, setContainerPadding] = useState(0)

  useEffect(() => {
    const updateDimensions = () => {
      const screenWidth = window.innerWidth
      const cardWidthPercent = screenWidth < 768 ? 0.9 : 0.88 // 90% on mobile, 88% on tablet
      const newCardWidth = screenWidth * cardWidthPercent
      const padding = (screenWidth - newCardWidth) / 2
      setCardWidth(newCardWidth)
      setContainerPadding(padding)
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Scroll to current index with smooth animation (250-300ms, ease-in-out)
  useEffect(() => {
    if (scrollContainerRef.current && cardWidth > 0) {
      const scrollPosition = currentIndex * (cardWidth + 16) // 16px gap
      scrollContainerRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      })
    }
  }, [currentIndex, cardWidth])
  
  // Smooth scroll function for dot clicks
  const scrollToIndex = useCallback((targetIndex) => {
    if (scrollContainerRef.current && cardWidth > 0) {
      const scrollPosition = targetIndex * (cardWidth + 16) // 16px gap
      scrollContainerRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      })
      setCurrentIndex(targetIndex)
    }
  }, [cardWidth])

  // Show arrow hint after 2-3 seconds
  useEffect(() => {
    if (isMounted && currentIndex === 0) {
      const timer = setTimeout(() => {
        setShowArrow(true)
      }, 2500)
      return () => clearTimeout(timer)
    } else {
      setShowArrow(false)
    }
  }, [isMounted, currentIndex])

  // Snap to nearest card based on scroll position (perfect center alignment)
  const snapToNearest = useCallback((velocity = 0) => {
    if (!scrollContainerRef.current || cardWidth === 0) return

    const container = scrollContainerRef.current
    const scrollPos = container.scrollLeft
    const cardWithGap = cardWidth + 16
    
    // Calculate which card is closest to center
    const containerWidth = container.clientWidth
    const centerPosition = scrollPos + (containerWidth / 2)
    const nearestIndex = Math.round((centerPosition - cardWidth / 2) / cardWithGap)
    
    // Velocity-based snapping (if swipe was fast enough)
    let targetIndex = nearestIndex
    if (Math.abs(velocity) > 0.5) {
      if (velocity > 0 && nearestIndex < features.length - 1) {
        targetIndex = nearestIndex + 1
      } else if (velocity < 0 && nearestIndex > 0) {
        targetIndex = nearestIndex - 1
      }
    }
    
    targetIndex = Math.max(0, Math.min(features.length - 1, targetIndex))
    
    // Smooth scroll to perfect center position
    const targetScrollPosition = targetIndex * cardWithGap
    container.scrollTo({
      left: targetScrollPosition,
      behavior: 'smooth'
    })
    
    setCurrentIndex(targetIndex)
  }, [cardWidth, features.length])

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    setIsDragging(true)
    setStartX(e.touches[0].pageX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
    lastTouchXRef.current = e.touches[0].pageX
    lastTouchTimeRef.current = Date.now()
    setShowArrow(false)
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || !scrollContainerRef.current) return
    e.preventDefault()
    
    const x = e.touches[0].pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - startX) * 1.5 // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk

    // Calculate velocity
    const now = Date.now()
    const timeDelta = now - lastTouchTimeRef.current
    if (timeDelta > 0) {
      const positionDelta = e.touches[0].pageX - lastTouchXRef.current
      const v = positionDelta / timeDelta
      setVelocity(v)
    }
    lastTouchXRef.current = e.touches[0].pageX
    lastTouchTimeRef.current = now
  }, [isDragging, startX, scrollLeft])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    snapToNearest(velocity)
    setVelocity(0)
  }, [isDragging, velocity, snapToNearest])

  // Mouse handlers for desktop
  const handleMouseDown = useCallback((e) => {
    setIsDragging(true)
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
    lastTouchXRef.current = e.pageX
    lastTouchTimeRef.current = Date.now()
    setShowArrow(false)
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !scrollContainerRef.current) return
    e.preventDefault()
    
    const x = e.pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - startX) * 1.5
    scrollContainerRef.current.scrollLeft = scrollLeft - walk

    const now = Date.now()
    const timeDelta = now - lastTouchTimeRef.current
    if (timeDelta > 0) {
      const positionDelta = e.pageX - lastTouchXRef.current
      const v = positionDelta / timeDelta
      setVelocity(v)
    }
    lastTouchXRef.current = e.pageX
    lastTouchTimeRef.current = now
  }, [isDragging, startX, scrollLeft])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    snapToNearest(velocity)
    setVelocity(0)
  }, [isDragging, velocity, snapToNearest])

  // Handle scroll events for snapping
  const handleScroll = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (!scrollContainerRef.current || isDragging) return
      const scrollPos = scrollContainerRef.current.scrollLeft
      const cardWithGap = cardWidth + 16
      const newIndex = Math.round(scrollPos / cardWithGap)
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < features.length) {
        setCurrentIndex(newIndex)
      }
    })
  }, [cardWidth, currentIndex, features.length, isDragging])

  // Navigate to next/previous
  const goToNext = useCallback(() => {
    if (currentIndex < features.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [currentIndex, features.length])

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }, [currentIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (containerRef.current?.contains(document.activeElement)) {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          goToNext()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          goToPrevious()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrevious])

  const isDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

  return (
    <div 
      ref={containerRef}
      className="w-full px-4 py-8 relative overflow-hidden"
      style={{
        paddingLeft: `max(${containerPadding}px, env(safe-area-inset-left))`,
        paddingRight: `max(${containerPadding}px, env(safe-area-inset-right))`,
      }}
    >
      {/* Background Gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: isDark 
            ? 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%)'
            : 'linear-gradient(180deg, #FFF7F0 0%, #FFF0E5 100%)',
        }}
      />
      
      {/* Floating Animation Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-10 left-10 opacity-20 dark:opacity-10"
          style={{
            animation: 'float 6s ease-in-out infinite',
            animationDelay: '0s',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
            <path d="M50 20L60 40L80 45L65 60L67 80L50 70L33 80L35 60L20 45L40 40L50 20Z" fill="#FF7E42" />
          </svg>
        </div>
        <div 
          className="absolute top-20 right-20 opacity-15 dark:opacity-8"
          style={{
            animation: 'float 8s ease-in-out infinite',
            animationDelay: '2s',
          }}
        >
          <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
            <ellipse cx="50" cy="50" rx="40" ry="25" fill="#FFB25A" />
          </svg>
        </div>
        <div 
          className="absolute bottom-20 left-20 opacity-10 dark:opacity-5"
          style={{
            animation: 'float 7s ease-in-out infinite',
            animationDelay: '4s',
          }}
        >
          <svg width="35" height="35" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="30" fill="#FF9C68" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <h3 
          className="text-center mb-8 font-semibold"
          style={{
            color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(44, 44, 44, 0.9)',
            fontSize: 'clamp(18px, 4vw, 24px)',
            fontFamily: "'Poppins', sans-serif",
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          Entdecke, was Foodspot Ranker kann
        </h3>

        {/* Desktop: Grid Layout */}
        <div className="hidden md:grid md:grid-cols-3 gap-4 lg:gap-6">
          {features.slice(0, 3).map((feature, index) => (
            <div key={feature.id} className="opacity-1 transition-opacity duration-300">
              <div className="bg-white dark:bg-gray-800 rounded-[20px] p-6 shadow-lg dark:shadow-xl">
                <div 
                  className="w-16 h-16 mb-4 mx-auto flex items-center justify-center rounded-[14px]"
                  style={{
                    color: feature.color,
                    background: `linear-gradient(135deg, ${feature.color}15 0%, ${feature.color}25 100%)`,
                  }}
                >
                  <div className="w-10 h-10">{feature.icon}</div>
                </div>
                <h4 className="font-bold mb-2 text-gray-900 dark:text-gray-100 text-center" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {feature.title}
                </h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm text-center leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:flex md:justify-center gap-4 lg:gap-6 mt-4 lg:mt-6">
          {features.slice(3).map((feature, index) => (
            <div key={feature.id} className="opacity-1 transition-opacity duration-300">
              <div className="bg-white dark:bg-gray-800 rounded-[20px] p-6 shadow-lg dark:shadow-xl">
                <div 
                  className="w-16 h-16 mb-4 mx-auto flex items-center justify-center rounded-[14px]"
                  style={{
                    color: feature.color,
                    background: `linear-gradient(135deg, ${feature.color}15 0%, ${feature.color}25 100%)`,
                  }}
                >
                  <div className="w-10 h-10">{feature.icon}</div>
                </div>
                <h4 className="font-bold mb-2 text-gray-900 dark:text-gray-100 text-center" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {feature.title}
                </h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm text-center leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: Swipeable Carousel */}
        <div className="md:hidden relative">
          <div
            ref={scrollContainerRef}
            className="overflow-x-hidden"
            data-scroll-container
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              scrollBehavior: 'smooth',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onScroll={handleScroll}
          >
            <div 
              className="flex gap-4"
              style={{
                width: `${features.length * (cardWidth + 16)}px`,
                paddingLeft: `${containerPadding}px`,
                paddingRight: `${containerPadding}px`,
              }}
            >
              {features.map((feature, index) => (
                <div
                  key={feature.id}
                  data-scroll-item
                  style={{
                    scrollSnapAlign: 'center',
                    scrollSnapStop: 'always',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: cardWidth,
                    minWidth: cardWidth,
                    maxWidth: cardWidth,
                  }}
                >
                  <FeatureCard
                    feature={feature}
                    index={index}
                    isActive={index === currentIndex}
                    cardWidth={cardWidth}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Arrow Hint */}
          {showArrow && currentIndex < features.length - 1 && (
            <div
              className="absolute bottom-24 left-1/2 transform -translate-x-1/2 pointer-events-none"
              style={{
                animation: 'bounceArrow 2s ease-in-out infinite',
              }}
            >
              <button
                onClick={goToNext}
                className="w-10 h-10 rounded-full bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm flex items-center justify-center shadow-lg"
                aria-label="Weiter zur nächsten Seite"
                tabIndex={0}
              >
                <svg 
                  className="w-6 h-6 text-[#FF7E42] dark:text-[#FF9357]" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Pagination Dots */}
          <div 
            className="flex justify-center items-center gap-2 mt-6"
            role="tablist"
            aria-label="Feature-Seiten"
          >
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollToIndex(index)}
                className={`rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#FF7E42] dark:focus:ring-[#FF9357] ${
                  index === currentIndex 
                    ? 'bg-[#FF7E42] dark:bg-[#FF9357] cursor-default' 
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 cursor-pointer'
                }`}
                style={{
                  width: index === currentIndex ? '12px' : '8px',
                  height: index === currentIndex ? '12px' : '8px',
                  transition: 'width 0.3s ease-in-out, height 0.3s ease-in-out, background-color 0.25s ease-in-out',
                }}
                aria-label={`Seite ${index + 1} von ${features.length}`}
                aria-selected={index === currentIndex}
                role="tab"
                tabIndex={0}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Inspiration Section - Beispiel-Listen */}
      <div 
        className="mt-8 relative z-10"
        style={{
          opacity: isMounted ? 1 : 0,
          transform: isMounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease-out 0.5s, transform 0.6s ease-out 0.5s',
        }}
      >
        <h4 
          className="text-center font-semibold mb-4"
          style={{
            color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(44, 44, 44, 0.9)',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 'clamp(14px, 3vw, 16px)',
          }}
        >
          💡 Inspiration für deine erste Liste
        </h4>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { emoji: '🥙', text: 'Beste Döner' },
            { emoji: '🍕', text: 'Pizza-Topliste' },
            { emoji: '🍔', text: 'Burger-Ranking' },
            { emoji: '🍜', text: 'Asiatisch' },
            { emoji: '🌮', text: 'Mexikanisch' },
            { emoji: '🍣', text: 'Sushi-Guide' },
          ].map((item, index) => (
            <div
              key={index}
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-[16px] px-4 py-3 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group"
              style={{
                transform: 'translateY(0)',
                transition: 'transform 0.3s ease-out, box-shadow 0.3s ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{item.emoji}</span>
                <span 
                  className="font-medium text-gray-800 dark:text-gray-200 text-sm"
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  {item.text}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p 
          className="text-center mt-4 text-gray-500 dark:text-gray-400 text-xs"
          style={{
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Tippe auf eine Kategorie für Inspiration – oder erfinde deine eigene!
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes bounceArrow {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.7; }
          50% { transform: translateX(-50%) translateY(-8px); opacity: 1; }
        }
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }
        
        /* Smooth scroll behavior for snap-to-center */
        [data-scroll-container] {
          scroll-behavior: smooth;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        
        [data-scroll-item] {
          scroll-snap-align: center;
          scroll-snap-stop: always;
        }
      `}</style>
    </div>
  )
}

export default FeaturesSection
