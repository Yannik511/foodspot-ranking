import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { hapticFeedback } from '../utils/haptics'
import { springEasing } from '../utils/animations'

// Feature Card Component - Modern App-Onboarding Style with Float Effect
function FeatureCard({ feature, index, isActive, cardWidth }) {
  const { isDark } = useTheme()

  return (
    <div
      className="flex-shrink-0"
      style={{
        width: `${cardWidth}px`,
        maxWidth: `${cardWidth}px`,
        minWidth: `${cardWidth}px`,
        height: '100%',
        minHeight: 'clamp(320px, 48vh, 400px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px',
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-[28px] p-8 h-full flex flex-col relative overflow-hidden"
        style={{
          boxShadow: isActive
            ? (isDark
              ? '0 20px 60px rgba(184, 92, 44, 0.3), 0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 20px 60px rgba(255, 125, 66, 0.25), 0 8px 24px rgba(255, 77, 109, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)')
            : (isDark
              ? '0 8px 24px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)'
              : '0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)'),
          transform: isActive ? 'translateY(-8px) scale(1)' : 'translateY(0) scale(0.96)',
          opacity: isActive ? 1 : 0.75,
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          backdropFilter: isActive ? 'blur(20px)' : 'blur(10px)',
          WebkitBackdropFilter: isActive ? 'blur(20px)' : 'blur(10px)',
        }}
      >
        {/* Glow Effect für aktive Card */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-[28px] opacity-30 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(255, 125, 66, 0.15) 0%, transparent 70%)',
              animation: 'glowPulse 3s ease-in-out infinite',
            }}
          />
        )}

        <div className="flex flex-col h-full relative z-10">
          {/* Icon - Mit Animation wenn aktiv */}
          <div className="mb-6 mx-auto flex items-center justify-center flex-shrink-0">
            <div
              className="relative flex items-center justify-center rounded-[20px]"
              style={{
                width: 'clamp(72px, 18vw, 88px)',
                height: 'clamp(72px, 18vw, 88px)',
                background: isActive
                  ? `linear-gradient(135deg, #FFB25A 0%, #FF9C68 40%, #FF7E42 80%, #FF6B4A 100%)`
                  : `linear-gradient(135deg, ${feature.color}12 0%, ${feature.color}20 100%)`,
                boxShadow: isActive
                  ? '0 8px 24px rgba(255, 125, 66, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                  : '0 4px 12px rgba(0, 0, 0, 0.08)',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                animation: isActive ? 'iconPulse 2s ease-in-out infinite' : 'none',
              }}
            >
              <div
                style={{
                  width: 'clamp(40px, 10vw, 48px)',
                  height: 'clamp(40px, 10vw, 48px)',
                  color: isActive ? '#FFFFFF' : feature.color,
                  filter: isActive ? 'drop-shadow(0 2px 8px rgba(255, 255, 255, 0.3))' : 'none',
                  transition: 'all 0.4s ease-out',
                }}
              >
                {feature.icon}
              </div>
            </div>
          </div>

          {/* Title - Größer und visuell stärker */}
          <h4
            className="text-center mb-4 flex-shrink-0"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(22px, 5.5vw, 28px)',
              lineHeight: '1.2',
              color: isDark ? '#FFFFFF' : '#1F2937',
              minHeight: 'clamp(52px, 10vw, 68px)',
              letterSpacing: '-0.02em',
              opacity: isActive ? 1 : 0.85,
              transform: isActive ? 'translateY(0)' : 'translateY(4px)',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {feature.title}
          </h4>

          {/* Description - Heller und besser lesbar */}
          <p
            className="text-center flex-1 flex items-center justify-center"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
              fontSize: 'clamp(15px, 3.5vw, 17px)',
              lineHeight: '1.7',
              color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(107, 114, 128, 0.85)',
              letterSpacing: '0.01em',
              opacity: isActive ? 1 : 0.7,
              transform: isActive ? 'translateY(0)' : 'translateY(4px)',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s',
              paddingTop: '8px',
            }}
          >
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  )
}

function FeaturesSection() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [isMounted, setIsMounted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showArrow, setShowArrow] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [velocity, setVelocity] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  const containerRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const lastTouchXRef = useRef(0)
  const lastTouchTimeRef = useRef(0)
  const animationFrameRef = useRef(null)
  const touchStartTimeRef = useRef(0)
  const touchStartXRef = useRef(0)

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

  // Calculate card width - all cards same size, consistent across all screens
  const [cardWidth, setCardWidth] = useState(0)
  const [containerPadding, setContainerPadding] = useState(0)

  useEffect(() => {
    const updateDimensions = () => {
      const screenWidth = window.innerWidth
      const safeAreaLeft = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-left)') || '0', 10)
      const safeAreaRight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)') || '0', 10)
      const availableWidth = screenWidth - safeAreaLeft - safeAreaRight - 32 // 32px = 16px padding on each side
      
      // Consistent card width for all 5 screens - 85% on mobile, 80% on tablet for better spacing
      const cardWidthPercent = screenWidth < 768 ? 0.85 : 0.80
      const newCardWidth = Math.floor(availableWidth * cardWidthPercent)
      const padding = (availableWidth - newCardWidth) / 2 + safeAreaLeft
      setCardWidth(newCardWidth)
      setContainerPadding(Math.max(padding, 16))
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Scroll to current index with smooth animation and haptic feedback
  useEffect(() => {
    if (scrollContainerRef.current && cardWidth > 0 && !isDragging) {
      setIsTransitioning(true)
      const cardWithGap = cardWidth + 16 // 16px gap
      const containerWidth = scrollContainerRef.current.clientWidth
      // Calculate scroll position to center the card
      const scrollPosition = (currentIndex * cardWithGap)
      scrollContainerRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      })
      
      // Light haptic feedback on transition
      hapticFeedback.light()
      
      // Reset transitioning state after animation
      setTimeout(() => {
        setIsTransitioning(false)
      }, 300)
    }
  }, [currentIndex, cardWidth, isDragging])
  
  // Smooth scroll function for dot clicks with haptic feedback
  const scrollToIndex = useCallback((targetIndex) => {
    if (scrollContainerRef.current && cardWidth > 0 && targetIndex !== currentIndex) {
      setIsTransitioning(true)
      hapticFeedback.medium()
      const cardWithGap = cardWidth + 16 // 16px gap
      const scrollPosition = targetIndex * cardWithGap
      scrollContainerRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      })
      setCurrentIndex(targetIndex)
      
      setTimeout(() => {
        setIsTransitioning(false)
      }, 300)
    }
  }, [cardWidth, currentIndex])

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

  // Auto-scroll back to first screen when reaching the last dot
  useEffect(() => {
    if (isMounted && currentIndex === features.length - 1) {
      const timer = setTimeout(() => {
        hapticFeedback.success()
        scrollToIndex(0)
      }, 2000) // Wait 2 seconds on last screen before auto-scrolling back
      return () => clearTimeout(timer)
    }
  }, [isMounted, currentIndex, features.length, scrollToIndex])

  // Snap to nearest card based on scroll position (perfect center alignment) with improved velocity detection
  const snapToNearest = useCallback((velocity = 0) => {
    if (!scrollContainerRef.current || cardWidth === 0) return

    const container = scrollContainerRef.current
    const scrollPos = container.scrollLeft
    const cardWithGap = cardWidth + 16
    
    // Calculate which card is closest to center
    const containerWidth = container.clientWidth
    const centerPosition = scrollPos + (containerWidth / 2)
    const nearestIndex = Math.round((centerPosition - cardWidth / 2) / cardWithGap)
    
    // Improved velocity-based snapping with threshold
    let targetIndex = nearestIndex
    const velocityThreshold = 0.3 // Lower threshold for more responsive swipes
    
    if (Math.abs(velocity) > velocityThreshold) {
      if (velocity > 0 && nearestIndex < features.length - 1) {
        targetIndex = nearestIndex + 1
      } else if (velocity < 0 && nearestIndex > 0) {
        targetIndex = nearestIndex - 1
      }
    }
    
    // Also check if we swiped past 30% of card width
    const scrollDelta = scrollPos % cardWithGap
    const swipeThreshold = cardWithGap * 0.3
    
    if (scrollDelta > swipeThreshold && targetIndex < features.length - 1) {
      targetIndex = nearestIndex + 1
    } else if (scrollDelta < -swipeThreshold && targetIndex > 0) {
      targetIndex = nearestIndex - 1
    }
    
    targetIndex = Math.max(0, Math.min(features.length - 1, targetIndex))
    
    // Only snap if index changed
    if (targetIndex !== currentIndex) {
      setIsTransitioning(true)
      hapticFeedback.light()
      
      // Smooth scroll to perfect center position
      const targetScrollPosition = targetIndex * cardWithGap
      container.scrollTo({
        left: targetScrollPosition,
        behavior: 'smooth'
      })
      
      setCurrentIndex(targetIndex)
      
      setTimeout(() => {
        setIsTransitioning(false)
      }, 300)
    }
  }, [cardWidth, features.length, currentIndex])

  // Improved touch handlers with better gesture detection
  const handleTouchStart = useCallback((e) => {
    if (isTransitioning) return
    
    setIsDragging(true)
    const touch = e.touches[0]
    setStartX(touch.pageX - (scrollContainerRef.current?.offsetLeft || 0))
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0)
    lastTouchXRef.current = touch.pageX
    lastTouchTimeRef.current = Date.now()
    touchStartXRef.current = touch.pageX
    touchStartTimeRef.current = Date.now()
    setShowArrow(false)
    
    // Prevent default to avoid scrolling conflicts
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.scrollBehavior = 'auto'
    }
  }, [isTransitioning])

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || !scrollContainerRef.current || isTransitioning) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const touch = e.touches[0]
    const x = touch.pageX - (scrollContainerRef.current.offsetLeft || 0)
    const walk = (x - startX) * 1.2 // Reduced multiplier for more control
    scrollContainerRef.current.scrollLeft = scrollLeft - walk

    // Improved velocity calculation for better swipe detection
    const now = Date.now()
    const timeDelta = now - lastTouchTimeRef.current
    if (timeDelta > 0) {
      const positionDelta = touch.pageX - lastTouchXRef.current
      const v = positionDelta / timeDelta
      setVelocity(v * 10) // Scale velocity for better detection
    }
    
    // Update current index during drag for reactive dots
    const scrollPos = scrollContainerRef.current.scrollLeft
    const cardWithGap = cardWidth + 16
    const newIndex = Math.round(scrollPos / cardWithGap)
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < features.length) {
      setCurrentIndex(newIndex)
    }
    
    lastTouchXRef.current = touch.pageX
    lastTouchTimeRef.current = now
  }, [isDragging, startX, scrollLeft, isTransitioning, cardWidth, currentIndex, features.length])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || !scrollContainerRef.current) return
    
    setIsDragging(false)
    
    // Restore smooth scrolling
    scrollContainerRef.current.style.scrollBehavior = 'smooth'
    
    // Calculate final velocity
    const timeDelta = Date.now() - touchStartTimeRef.current
    const distanceDelta = Math.abs(lastTouchXRef.current - touchStartXRef.current)
    const finalVelocity = timeDelta > 0 ? (distanceDelta / timeDelta) * 10 : 0
    
    snapToNearest(finalVelocity)
    setVelocity(0)
  }, [isDragging, snapToNearest])

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

  // Handle scroll events for reactive dots (only when not dragging)
  const handleScroll = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (!scrollContainerRef.current || isDragging || isTransitioning) return
      const scrollPos = scrollContainerRef.current.scrollLeft
      const cardWithGap = cardWidth + 16
      const newIndex = Math.round(scrollPos / cardWithGap)
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < features.length) {
        setCurrentIndex(newIndex)
      }
    })
  }, [cardWidth, currentIndex, features.length, isDragging, isTransitioning])

  // Navigate to next/previous with haptic feedback
  const goToNext = useCallback(() => {
    if (currentIndex < features.length - 1 && !isTransitioning) {
      hapticFeedback.medium()
      setCurrentIndex(currentIndex + 1)
    }
  }, [currentIndex, features.length, isTransitioning])

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      hapticFeedback.medium()
      setCurrentIndex(currentIndex - 1)
    }
  }, [currentIndex, isTransitioning])

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
              transition: `opacity 0.6s ${springEasing.default}, transform 0.6s ${springEasing.gentle}`,
          }}
        >
          Entdecke, was Rankify kann
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

        {/* Mobile: Swipeable Carousel - Optimized for native feel */}
        <div className="md:hidden relative" style={{ width: '100%' }}>
          <div
            ref={scrollContainerRef}
            className="touch-pan-x"
            data-scroll-container
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollSnapType: isDragging ? 'none' : 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              scrollBehavior: isDragging ? 'auto' : 'smooth',
              touchAction: 'pan-x',
              cursor: isDragging ? 'grabbing' : 'grab',
              width: '100%',
              position: 'relative',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
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
                minWidth: `${features.length * (cardWidth + 16)}px`,
                paddingLeft: `${containerPadding}px`,
                paddingRight: `${containerPadding}px`,
                display: 'flex',
                flexDirection: 'row',
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
                    alignItems: 'stretch',
                    width: `${cardWidth}px`,
                    minWidth: `${cardWidth}px`,
                    maxWidth: `${cardWidth}px`,
                    height: 'clamp(320px, 48vh, 400px)',
                    flexShrink: 0,
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

          {/* Pagination Dots - Modern Progress Indicator */}
          <div 
            className="flex justify-center items-center gap-1.5 mt-6"
            role="tablist"
            aria-label="Feature-Seiten"
            style={{
              marginTop: 'clamp(1.5rem, 4vh, 2rem)',
            }}
          >
            {features.map((_, index) => {
              const isActive = index === currentIndex
              const distance = Math.abs(index - currentIndex)
              
              return (
                <button
                  key={index}
                  onClick={() => scrollToIndex(index)}
                  onTouchStart={() => hapticFeedback.light()}
                  className={`rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#FF7E42] dark:focus:ring-[#FF9357] ${
                    isActive 
                      ? 'cursor-default' 
                      : 'cursor-pointer'
                  }`}
                  style={{
                    width: isActive ? '24px' : '6px',
                    height: '6px',
                    minWidth: isActive ? '24px' : '6px',
                    minHeight: '6px',
                    background: isActive
                      ? 'linear-gradient(90deg, #FF7E42 0%, #FF9C68 50%, #FF7E42 100%)'
                      : distance === 1
                      ? 'rgba(255, 125, 66, 0.4)'
                      : 'rgba(156, 163, 175, 0.4)',
                    borderRadius: isActive ? '3px' : '50%',
                    opacity: distance > 1 ? 0.3 : 1,
                    transform: isActive ? 'scale(1)' : 'scale(1)',
                    transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: isActive
                      ? '0 2px 8px rgba(255, 125, 66, 0.4)'
                      : 'none',
                  }}
                  aria-label={`Zur Seite ${index + 1} springen`}
                  aria-selected={isActive}
                  role="tab"
                  tabIndex={0}
                />
              )
            })}
          </div>
        </div>

        {/* Inspiration Section - Modern Grid Layout */}
        <div 
          className="mt-10 relative z-10 max-w-md mx-auto"
          style={{
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 0.6s ${springEasing.default} 0.5s, transform 0.6s ${springEasing.gentle} 0.5s`,
            paddingLeft: `max(${containerPadding}px, env(safe-area-inset-left))`,
            paddingRight: `max(${containerPadding}px, env(safe-area-inset-right))`,
          }}
        >
          <h4 
            className="text-center font-semibold mb-6"
            style={{
              color: isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(31, 41, 55, 0.95)',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: 'clamp(16px, 4vw, 20px)',
              letterSpacing: '-0.01em',
            }}
          >
            Wähle dein erstes Food-Abenteuer 🍜
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: '🥙', text: 'Beste Döner', gradient: 'linear-gradient(135deg, #FFE4C3 0%, #FFD4A3 100%)' },
              { emoji: '🍕', text: 'Pizza-Topliste', gradient: 'linear-gradient(135deg, #FFD4A3 0%, #FFC98A 100%)' },
              { emoji: '🍔', text: 'Burger-Ranking', gradient: 'linear-gradient(135deg, #FFC98A 0%, #FFB25A 100%)' },
              { emoji: '🍜', text: 'Asiatisch', gradient: 'linear-gradient(135deg, #FFB25A 0%, #FF9C68 100%)' },
              { emoji: '🥓', text: 'Bratwurst', gradient: 'linear-gradient(135deg, #FF9C68 0%, #FF8E53 100%)' },
              { emoji: '🍣', text: 'Sushi-Guide', gradient: 'linear-gradient(135deg, #FF8E53 0%, #FF7E42 100%)' },
            ].map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  hapticFeedback.light()
                  navigate('/select-category')
                }}
                onTouchStart={() => hapticFeedback.light()}
                className="relative rounded-[20px] p-4 shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-300 group overflow-hidden"
                style={{
                  background: isDark
                    ? `linear-gradient(135deg, rgba(255, 157, 104, 0.15) 0%, rgba(255, 126, 66, 0.2) 100%)`
                    : item.gradient,
                  border: isDark
                    ? '1px solid rgba(255, 157, 104, 0.2)'
                    : '1px solid rgba(255, 126, 66, 0.1)',
                  minHeight: '80px',
                  transform: 'translateY(0)',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 125, 66, 0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                }}
              >
                {/* Subtle overlay on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-[20px]"
                  style={{
                    background: 'radial-gradient(circle at center, rgba(255, 125, 66, 0.3) 0%, transparent 70%)',
                  }}
                />
                <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                  <span 
                    className="text-2xl"
                    style={{
                      filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                      transform: 'scale(1)',
                      transition: 'transform 0.3s ease-out',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.15) rotate(5deg)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    {item.emoji}
                  </span>
                  <span 
                    className="font-semibold text-gray-800 dark:text-gray-100 text-sm"
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 'clamp(13px, 3vw, 15px)',
                      fontWeight: 600,
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes iconPulse {
          0%, 100% { 
            transform: scale(1.08);
            box-shadow: 0 8px 24px rgba(255, 125, 66, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          }
          50% { 
            transform: scale(1.12);
            box-shadow: 0 12px 32px rgba(255, 125, 66, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.4);
          }
        }

        @keyframes glowPulse {
          0%, 100% { 
            opacity: 0.3;
            transform: scale(1);
          }
          50% { 
            opacity: 0.5;
            transform: scale(1.05);
          }
        }

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
          overscroll-behavior-x: contain;
        }
        
        [data-scroll-item] {
          scroll-snap-align: center;
          scroll-snap-stop: always;
        }
        
        /* Improved touch handling */
        .touch-pan-x {
          touch-action: pan-x;
        }
        
        /* Smooth card transitions */
        [data-scroll-item] > * {
          transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease-out;
        }
        
        /* Hide scrollbar but keep functionality */
        [data-scroll-container]::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        
        /* Smooth momentum scrolling on iOS */
        @supports (-webkit-overflow-scrolling: touch) {
          [data-scroll-container] {
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </div>
  )
}

export default FeaturesSection
