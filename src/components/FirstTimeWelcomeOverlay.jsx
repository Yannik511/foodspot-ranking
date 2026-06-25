import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hapticFeedback } from '../utils/haptics'

const TIER_BADGES = [
  { tier: 'S', color: '#E53935', glow: 'rgba(229,57,53,0.55)' },
  { tier: 'A', color: '#FB8C00', glow: 'rgba(251,140,0,0.5)' },
  { tier: 'B', color: '#FDD835', glow: 'rgba(253,216,53,0.5)' },
  { tier: 'C', color: '#43A047', glow: 'rgba(67,160,71,0.5)' },
  { tier: 'D', color: '#1E88E5', glow: 'rgba(30,136,229,0.5)' },
]

export default function FirstTimeWelcomeOverlay() {
  const navigate = useNavigate()
  const [pressed, setPressed] = useState(false)

  const handleStart = () => {
    hapticFeedback.medium()
    navigate('/select-category')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'radial-gradient(120% 100% at 50% 0%, #160B05 0%, #2B1A0A 35%, #4F2A0E 65%, #7A3914 90%, #B85C2C 100%)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        overflow: 'hidden',
      }}
      role="dialog"
      aria-label="Willkommen bei Rankify"
    >
      <style>{`
        @keyframes ftw-spring-up {
          0% { opacity: 0; transform: translateY(36px) scale(0.85); }
          55% { opacity: 1; transform: translateY(-6px) scale(1.06); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ftw-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Ambient orange glow behind tier badges */}
      <div style={{
        position: 'absolute',
        top: '12%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 420, height: 420,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,126,66,0.22) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Content area */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        gap: 32,
        position: 'relative', zIndex: 1,
      }}>
        {/* Tier badges row */}
        <div style={{
          display: 'flex', gap: 10,
          alignItems: 'center', justifyContent: 'center',
          width: '100%', maxWidth: 340,
        }}>
          {TIER_BADGES.map((b, i) => (
            <div
              key={b.tier}
              style={{
                width: 56, height: 56, borderRadius: 15,
                background: `linear-gradient(135deg, ${b.color}, ${b.color}d0)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 24,
                color: '#fff',
                boxShadow: `0 10px 26px ${b.glow}, inset 0 1px 0 rgba(255,255,255,0.30)`,
                border: '1.5px solid rgba(255,255,255,0.22)',
                textShadow: '0 1px 4px rgba(0,0,0,0.25)',
                opacity: 0,
                animation: `ftw-spring-up 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.15 + i * 0.08}s both`,
              }}
            >
              {b.tier}
            </div>
          ))}
        </div>

        {/* Title + Subtext */}
        <div style={{
          textAlign: 'center',
          maxWidth: 340,
          opacity: 0,
          animation: 'ftw-fade-up 0.5s ease-out 0.75s both',
        }}>
          <h1 style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: 32,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            color: '#ffffff',
            margin: 0,
            marginBottom: 12,
            textShadow: '0 2px 14px rgba(0,0,0,0.35)',
          }}>
            Deine erste Liste wartet.
          </h1>
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 400,
            fontSize: 15,
            color: 'rgba(255,255,255,0.74)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            Wähle eine Kategorie, gib ihr einen Namen — und fang an zu ranken.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div style={{
        padding: '12px 20px 28px',
        maxWidth: 420, width: '100%',
        margin: '0 auto',
        position: 'relative', zIndex: 1,
        opacity: 0,
        animation: 'ftw-fade-up 0.5s ease-out 1.0s both',
      }}>
        <button
          onClick={handleStart}
          onTouchStart={() => setPressed(true)}
          onTouchEnd={() => setPressed(false)}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          style={{
            width: '100%',
            padding: '17px 20px',
            borderRadius: 18,
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #FF8438 0%, #FF6446 50%, #E63B3B 100%)',
            boxShadow: pressed
              ? '0 4px 14px rgba(229,59,59,0.45), inset 0 -2px 6px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.18)'
              : '0 12px 32px rgba(229,59,59,0.5), 0 6px 14px rgba(255,126,66,0.4), inset 0 -2px 6px rgba(0,0,0,0.18), inset 0 2px 4px rgba(255,255,255,0.18)',
            color: '#fff',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '0.01em',
            textShadow: '0 1px 4px rgba(0,0,0,0.25)',
            WebkitTapHighlightColor: 'transparent',
            transform: pressed ? 'scale(0.97)' : 'scale(1)',
            transition: 'transform 0.12s cubic-bezier(0.2, 0.65, 0.25, 1), box-shadow 0.18s ease',
          }}
        >
          Erste Liste erstellen
        </button>
      </div>
    </div>
  )
}
