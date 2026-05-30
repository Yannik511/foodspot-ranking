import { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { hapticFeedback } from '../utils/haptics'

const TIER_COLORS = {
  S: '#E53935',
  A: '#FB8C00',
  B: '#F9A825',
  C: '#43A047',
  D: '#1E88E5',
}

const FEATURES = [
  {
    emoji: '🏆',
    title: 'Bewerten & einordnen',
    desc: 'Vergib Punkte und setze Tiers — S bis D.',
    dim: false,
  },
  {
    emoji: '👥',
    title: 'Mit Freunden teilen',
    desc: 'Gemeinsam ranken und kommentieren.',
    dim: false,
  },
  {
    emoji: '📍',
    title: 'In der Nähe entdecken',
    desc: 'Bald: Top Spots in deiner Stadt.',
    dim: true,
  },
]

function WelcomeCard({ username, onCreateList, isCompact = false, foodEmoji = null }) {
  const { isDark } = useTheme()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setIsMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const spring = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  const ease = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%', overflow: 'hidden' }}>

      {/* ── TOP ZONE: gradient ── */}
      <div style={{
        background: 'linear-gradient(160deg, #FF9A5C 0%, #E8601A 48%, #9A3D08 100%)',
        padding: '36px 28px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>

        {/* Ambient glow behind icon */}
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,220,100,0.22) 0%, transparent 68%)',
          pointerEvents: 'none',
        }} />

        {/* Decorative circles */}
        <div style={{ position: 'absolute', bottom: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 10, left: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.035)', pointerEvents: 'none' }} />

        {/* App icon */}
        <img
          src="/icon.png"
          alt="Rankify"
          style={{
            width: 76, height: 76, borderRadius: 20,
            boxShadow: '0 16px 40px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)',
            display: 'block', objectFit: 'cover',
            position: 'relative', zIndex: 1,
            marginBottom: 12,
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'scale(1) translateY(0)' : 'scale(0.72) translateY(18px)',
            transition: `opacity 0.5s 0.05s ${spring}, transform 0.5s 0.05s ${spring}`,
          }}
        />

        {/* Title */}
        <h1 style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 40,
          color: '#fff', margin: '0 0 5px', letterSpacing: '-0.03em', lineHeight: 1.05,
          textShadow: '0 2px 10px rgba(0,0,0,0.22)',
          position: 'relative', zIndex: 1,
          opacity: isMounted ? 1 : 0,
          transform: isMounted ? 'translateY(0)' : 'translateY(14px)',
          transition: `opacity 0.4s 0.2s ${ease}, transform 0.4s 0.2s ${ease}`,
        }}>
          Rankify
        </h1>

        {/* Tagline */}
        <p style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: 15,
          color: 'rgba(255,255,255,0.68)', margin: '0 0 30px', textAlign: 'center',
          position: 'relative', zIndex: 1,
          opacity: isMounted ? 1 : 0,
          transform: isMounted ? 'translateY(0)' : 'translateY(10px)',
          transition: `opacity 0.4s 0.3s ${ease}, transform 0.4s 0.3s ${ease}`,
        }}>
          Deine Stadt. Dein Rang.
        </p>

        {/* Tier pills */}
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          {['S', 'A', 'B', 'C', 'D'].map((tier, i) => (
            <div
              key={tier}
              style={{
                width: 48, height: 48, borderRadius: 13, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 19,
                color: '#fff',
                background: `${TIER_COLORS[tier]}dd`,
                boxShadow: `0 4px 16px ${TIER_COLORS[tier]}66, inset 0 1px 0 rgba(255,255,255,0.28)`,
                border: '1.5px solid rgba(255,255,255,0.22)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                opacity: isMounted ? 1 : 0,
                transform: isMounted ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.65)',
                transition: `opacity 0.45s ${0.42 + i * 0.07}s ${spring}, transform 0.48s ${0.42 + i * 0.07}s ${spring}`,
              }}
            >
              {tier}
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM ZONE: dark/light ── */}
      <div style={{
        flex: 1,
        background: isDark ? '#0f0f13' : '#f5f5f7',
        padding: '22px 24px',
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 28px)`,
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Feature rows */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0, marginBottom: 8 }}>
          {FEATURES.map(({ emoji, title, desc, dim }, i) => (
            <div key={i}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0',
                opacity: isMounted ? (dim ? 0.5 : 1) : 0,
                transform: isMounted ? 'translateX(0)' : 'translateX(-14px)',
                transition: `opacity 0.4s ${0.82 + i * 0.1}s ${ease}, transform 0.4s ${0.82 + i * 0.1}s ${ease}`,
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                  background: isDark ? 'rgba(255,126,66,0.1)' : 'rgba(255,126,66,0.09)',
                  border: `1px solid ${isDark ? 'rgba(255,126,66,0.2)' : 'rgba(255,126,66,0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21,
                }}>
                  {emoji}
                </div>
                <div>
                  <p style={{
                    fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 15,
                    color: isDark ? '#fff' : '#111',
                    margin: 0, lineHeight: 1.25,
                  }}>
                    {title}
                  </p>
                  <p style={{
                    fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: 13,
                    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.38)',
                    margin: '2px 0 0', lineHeight: 1.4,
                  }}>
                    {desc}
                  </p>
                </div>
              </div>
              {i < FEATURES.length - 1 && (
                <div style={{
                  height: 1,
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.055)',
                  marginLeft: 62,
                }} />
              )}
            </div>
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            hapticFeedback.medium()
            if (typeof onCreateList === 'function') onCreateList()
          }}
          onTouchStart={() => hapticFeedback.light()}
          style={{
            width: '100%', padding: '17px', borderRadius: 18, border: 'none', cursor: 'pointer',
            background: isDark
              ? 'linear-gradient(135deg, #FF9357, #B85C2C)'
              : 'linear-gradient(135deg, #FF7E42, #FFB25A)',
            color: '#fff', fontSize: 16, fontWeight: 700,
            fontFamily: "'Poppins', sans-serif",
            boxShadow: '0 6px 24px rgba(255,126,66,0.42), 0 2px 8px rgba(255,126,66,0.2)',
            WebkitTapHighlightColor: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'translateY(0)' : 'translateY(18px)',
            transition: `opacity 0.4s 1.08s ${ease}, transform 0.4s 1.08s ${ease}`,
            flexShrink: 0,
          }}
        >
          {foodEmoji && <span style={{ fontSize: 20 }}>{foodEmoji}</span>}
          Los geht's
          <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

      </div>
    </div>
  )
}

export default WelcomeCard
