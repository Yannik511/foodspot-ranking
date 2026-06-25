import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hapticFeedback } from '../utils/haptics'

const TIER_BADGE = {
  S: { color: '#E53935', glow: 'rgba(229,57,53,0.55)' },
  A: { color: '#FB8C00', glow: 'rgba(251,140,0,0.5)' },
  B: { color: '#FDD835', glow: 'rgba(253,216,53,0.5)' },
  C: { color: '#43A047', glow: 'rgba(67,160,71,0.5)' },
  D: { color: '#1E88E5', glow: 'rgba(30,136,229,0.5)' },
}

const CARDS = [
  {
    bg: 'radial-gradient(120% 80% at 50% 0%, #1B2D4A 0%, #0A1424 55%, #000000 100%)',
    title: 'Ranke deine Spots',
    subtitle: 'Sortiere von S für absolute Lieblings bis D — pro Kategorie eine eigene Tier-Liste.',
  },
  {
    bg: 'radial-gradient(120% 80% at 50% 0%, #4A1F0A 0%, #2A1308 60%, #100804 100%)',
    title: 'Gemeinsam ranken',
    subtitle: 'Lade Freunde ein und bewertet eure Spots zusammen — vergleicht, entdeckt Neues.',
  },
  {
    bg: 'radial-gradient(120% 80% at 50% 0%, #0F3A28 0%, #07221B 55%, #000000 100%)',
    title: 'Spots auf der Karte',
    subtitle: 'Halte Lieblings-Spots am Standort fest und finde sie auf einer Karte wieder.',
  },
]

export default function Onboarding() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const scrollRef = useRef(null)
  const scrollingRef = useRef(false)
  const scrollTimeoutRef = useRef(null)
  const bgRefs = useRef([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [animatedCards, setAnimatedCards] = useState(() => new Set([0]))
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true })
  }, [user, loading, navigate])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    setAnimatedCards(prev => {
      if (prev.has(currentIndex)) return prev
      const next = new Set(prev)
      next.add(currentIndex)
      return next
    })
  }, [currentIndex])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // Live gradient cross-fade — write directly to DOM, no React re-render
    const x = el.scrollLeft / el.clientWidth
    bgRefs.current.forEach((node, i) => {
      if (!node) return
      const dist = Math.abs(x - i)
      node.style.opacity = String(Math.max(0, 1 - dist))
    })

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      const idx = Math.round(x)
      if (idx !== currentIndex && idx >= 0 && idx < 3) {
        setCurrentIndex(idx)
        hapticFeedback.light()
      }
      scrollingRef.current = false
    }, 60)
  }, [currentIndex])

  const goToPage = useCallback((index) => {
    const el = scrollRef.current
    if (!el || scrollingRef.current) return
    scrollingRef.current = true
    hapticFeedback.medium()
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
    setCurrentIndex(index)
    setTimeout(() => { scrollingRef.current = false }, 400)
  }, [])

  if (loading || user) return null

  const slideStyle = {
    flexShrink: 0,
    width: '100vw',
    minWidth: '100vw',
    maxWidth: '100vw',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    scrollSnapAlign: 'start',
    padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 24px calc(env(safe-area-inset-bottom, 0px) + 180px)',
    position: 'relative',
    zIndex: 1,
  }

  const glassPanelStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: '0 16px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
  }

  const headlineStyle = {
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 800,
    fontSize: 30,
    letterSpacing: '-0.025em',
    lineHeight: 1.1,
    color: '#ffffff',
    margin: 0,
    marginBottom: 10,
    textAlign: 'center',
    textShadow: '0 2px 14px rgba(0,0,0,0.35)',
  }

  const subtitleStyle = {
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 400,
    fontSize: 15,
    color: 'rgba(255,255,255,0.72)',
    margin: 0,
    lineHeight: 1.5,
    textAlign: 'center',
    maxWidth: 320,
    marginLeft: 'auto',
    marginRight: 'auto',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      {/* Cross-fading gradient layers */}
      {CARDS.map((card, i) => (
        <div
          key={`bg-${i}`}
          ref={el => { bgRefs.current[i] = el }}
          style={{
            position: 'absolute',
            inset: 0,
            background: card.bg,
            opacity: i === 0 ? 1 : 0,
            zIndex: 0,
            transition: 'opacity 0.15s linear',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* X close button — unchanged behavior */}
      <Link
        to="/"
        onClick={() => hapticFeedback.light()}
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
          right: 16,
          zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.14)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label="Schließen"
      >
        <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </Link>

      {/* Pager */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="onboarding-pager"
        style={{
          display: 'flex',
          width: '100vw',
          height: '100dvh',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <style>{`
          .onboarding-pager::-webkit-scrollbar { display: none; }
          @keyframes ob-spring-up {
            0% { opacity: 0; transform: translateY(28px) scale(0.92); }
            60% { opacity: 1; transform: translateY(-4px) scale(1.015); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes ob-scale-bounce {
            0% { opacity: 0; transform: scale(0.55); }
            60% { opacity: 1; transform: scale(1.08); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes ob-drop-in {
            0% { opacity: 0; transform: translateY(-60px) scale(0.85); }
            70% { opacity: 1; transform: translateY(6px) scale(1.04); }
            85% { transform: translateY(-2px) scale(0.99); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes ob-fade-up {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* ───────── CARD 1 — Tier-Listen ───────── */}
        <section style={slideStyle}>
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 28,
          }}>
            {/* Illustration: Glass container with big tier badges + spot examples */}
            <div style={{
              ...glassPanelStyle,
              borderRadius: 28,
              padding: '26px 22px',
              width: '100%',
              maxWidth: 320,
              display: 'flex', flexDirection: 'column', gap: 22,
            }}>
              {/* Big tier badges row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                {['S', 'A', 'B', 'C', 'D'].map((t, i) => {
                  const cfg = TIER_BADGE[t]
                  return (
                    <div
                      key={t}
                      style={{
                        width: 48, height: 48, borderRadius: 13,
                        background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}d0)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 22,
                        color: '#fff',
                        boxShadow: `0 8px 22px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.28)`,
                        border: '1.5px solid rgba(255,255,255,0.22)',
                        opacity: animatedCards.has(0) ? 1 : 0,
                        animation: animatedCards.has(0)
                          ? `ob-spring-up 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.1 + i * 0.07}s both`
                          : 'none',
                      }}
                    >
                      {t}
                    </div>
                  )
                })}
              </div>

              {/* Spot rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { tier: 'S', emoji: '🍔', name: 'The Burger Crew', sub: 'Burger · München' },
                  { tier: 'A', emoji: '🍕', name: 'Pizzeria Roma', sub: 'Pizza · München' },
                ].map((s, i) => {
                  const cfg = TIER_BADGE[s.tier]
                  return (
                    <div
                      key={s.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        opacity: animatedCards.has(0) ? 1 : 0,
                        animation: animatedCards.has(0)
                          ? `ob-fade-up 0.4s ease-out ${0.55 + i * 0.08}s both`
                          : 'none',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: cfg.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 14,
                        color: '#fff',
                        boxShadow: `0 4px 10px ${cfg.glow}`,
                        flexShrink: 0,
                      }}>
                        {s.tier}
                      </div>
                      <span style={{ fontSize: 18 }}>{s.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 13,
                          color: '#fff', margin: 0, lineHeight: 1.2,
                        }}>
                          {s.name}
                        </p>
                        <p style={{
                          fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: 11,
                          color: 'rgba(255,255,255,0.5)', margin: '2px 0 0',
                        }}>
                          {s.sub}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Text panel */}
            <div style={{
              ...glassPanelStyle,
              borderRadius: 20,
              padding: '18px 22px',
              width: '100%',
              maxWidth: 320,
              opacity: animatedCards.has(0) ? 1 : 0,
              animation: animatedCards.has(0)
                ? 'ob-fade-up 0.45s ease-out 0.75s both'
                : 'none',
            }}>
              <h2 style={headlineStyle}>{CARDS[0].title}</h2>
              <p style={subtitleStyle}>{CARDS[0].subtitle}</p>
            </div>
          </div>
        </section>

        {/* ───────── CARD 2 — Mit Freunden ───────── */}
        <section style={slideStyle}>
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 28,
          }}>
            {/* Avatar row inside glass panel */}
            <div style={{
              ...glassPanelStyle,
              borderRadius: 28,
              padding: '30px 22px',
              width: '100%',
              maxWidth: 320,
              display: 'flex', flexDirection: 'column', gap: 18,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {[
                  { name: 'Lukas', initial: 'L', color: '#FF7E42', glow: 'rgba(255,126,66,0.7)' },
                  { name: 'Anna', initial: 'A', color: '#43A047', glow: 'rgba(67,160,71,0.6)' },
                  { name: 'Tim', initial: 'T', color: '#1E88E5', glow: 'rgba(30,136,229,0.6)' },
                  { name: 'Eva', initial: 'E', color: '#E53935', glow: 'rgba(229,57,53,0.6)' },
                ].map((f, i) => (
                  <div
                    key={f.name}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      opacity: animatedCards.has(1) ? 1 : 0,
                      animation: animatedCards.has(1)
                        ? `ob-scale-bounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.1 + i * 0.1}s both`
                        : 'none',
                    }}
                  >
                    <div style={{
                      width: 60, height: 60, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${f.color}, ${f.color}cc)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 22,
                      color: '#fff',
                      boxShadow: `0 0 24px ${f.glow}, 0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)`,
                      border: '2px solid rgba(255,255,255,0.25)',
                    }}>
                      {f.initial}
                    </div>
                    <span style={{
                      fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600,
                      color: 'rgba(255,255,255,0.85)',
                    }}>
                      {f.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Activity chip */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                opacity: animatedCards.has(1) ? 1 : 0,
                animation: animatedCards.has(1)
                  ? 'ob-fade-up 0.4s ease-out 0.55s both'
                  : 'none',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#FF7E42',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 12,
                  color: '#fff',
                  flexShrink: 0,
                }}>L</div>
                <p style={{
                  flex: 1, minWidth: 0,
                  fontFamily: "'Poppins', sans-serif", fontSize: 12,
                  color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.35,
                }}>
                  <strong style={{ fontWeight: 700, color: '#fff' }}>Lukas</strong> hat <strong style={{ fontWeight: 700, color: '#fff' }}>Augustiner</strong> zur B-Tier hinzugefügt
                </p>
              </div>
            </div>

            {/* Text panel */}
            <div style={{
              ...glassPanelStyle,
              borderRadius: 20,
              padding: '18px 22px',
              width: '100%',
              maxWidth: 320,
              opacity: animatedCards.has(1) ? 1 : 0,
              animation: animatedCards.has(1)
                ? 'ob-fade-up 0.45s ease-out 0.7s both'
                : 'none',
            }}>
              <h2 style={headlineStyle}>{CARDS[1].title}</h2>
              <p style={subtitleStyle}>{CARDS[1].subtitle}</p>
            </div>
          </div>
        </section>

        {/* ───────── CARD 3 — Karte ───────── */}
        <section style={slideStyle}>
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 28,
          }}>
            {/* Map mock in glass container */}
            <div style={{
              ...glassPanelStyle,
              borderRadius: 28,
              padding: 18,
              width: '100%',
              maxWidth: 320,
            }}>
              <div style={{
                width: '100%', height: 220,
                borderRadius: 18,
                background: 'linear-gradient(180deg, #0d2419 0%, #050d09 100%)',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)',
              }}>
                {/* Grid lines (subtle, dark map look) */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
                  `,
                  backgroundSize: '32px 32px',
                }} />

                {/* Stylized "road" curves */}
                <svg
                  width="100%" height="100%"
                  viewBox="0 0 280 220"
                  style={{ position: 'absolute', inset: 0 }}
                  preserveAspectRatio="none"
                >
                  <path
                    d="M-20 80 Q 80 60, 150 100 T 320 70"
                    stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="none"
                  />
                  <path
                    d="M-10 160 Q 90 130, 180 170 T 320 140"
                    stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none"
                  />
                </svg>

                {/* Pins, drop in nacheinander */}
                {[
                  { left: '24%', top: '32%', color: '#E53935', glow: 'rgba(229,57,53,0.7)', delay: 0.15 },
                  { left: '58%', top: '48%', color: '#FB8C00', glow: 'rgba(251,140,0,0.7)', delay: 0.32 },
                  { left: '40%', top: '72%', color: '#43A047', glow: 'rgba(67,160,71,0.7)', delay: 0.5 },
                ].map((p, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: p.left, top: p.top,
                      transform: 'translate(-50%, -100%)',
                      opacity: animatedCards.has(2) ? 1 : 0,
                      animation: animatedCards.has(2)
                        ? `ob-drop-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) ${p.delay}s both`
                        : 'none',
                    }}
                  >
                    <div style={{
                      width: 30, height: 30,
                      borderRadius: '50% 50% 50% 0',
                      background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                      transform: 'rotate(-45deg)',
                      boxShadow: `0 0 20px ${p.glow}, 0 6px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)`,
                      border: '1.5px solid rgba(255,255,255,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        width: 11, height: 11, borderRadius: '50%',
                        background: '#fff',
                        transform: 'rotate(45deg)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Text panel */}
            <div style={{
              ...glassPanelStyle,
              borderRadius: 20,
              padding: '18px 22px',
              width: '100%',
              maxWidth: 320,
              opacity: animatedCards.has(2) ? 1 : 0,
              animation: animatedCards.has(2)
                ? 'ob-fade-up 0.45s ease-out 0.7s both'
                : 'none',
            }}>
              <h2 style={headlineStyle}>{CARDS[2].title}</h2>
              <p style={subtitleStyle}>{CARDS[2].subtitle}</p>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom: Dots + CTA (CTA only on last card) */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 20,
        padding: `18px 24px calc(env(safe-area-inset-bottom, 0px) + 18px)`,
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 35%, transparent)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        pointerEvents: 'none',
      }}>
        {/* Dots — sit directly above the button on card 3 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'auto' }}>
          {[0, 1, 2].map(i => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              style={{
                width: i === currentIndex ? 26 : 8,
                height: 8,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                background: i === currentIndex
                  ? '#FF7E42'
                  : 'rgba(255,255,255,0.28)',
                boxShadow: i === currentIndex
                  ? '0 0 12px rgba(255,126,66,0.5)'
                  : 'none',
                transition: 'width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, box-shadow 0.2s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-label={`Card ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA on last card */}
        {currentIndex === 2 && (
          <Link
            to="/register"
            onClick={(e) => {
              hapticFeedback.medium()
              setPressed(false)
            }}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            style={{
              width: '100%', maxWidth: 360,
              padding: '17px 20px',
              borderRadius: 18,
              background: 'linear-gradient(135deg, #FF8438 0%, #FF6446 50%, #E63B3B 100%)',
              boxShadow: pressed
                ? '0 4px 14px rgba(229,59,59,0.45), inset 0 -2px 6px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.18)'
                : '0 12px 32px rgba(229,59,59,0.5), 0 6px 14px rgba(255,126,66,0.4), inset 0 -2px 6px rgba(0,0,0,0.18), inset 0 2px 4px rgba(255,255,255,0.18)',
              color: '#fff',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: '0.01em',
              textAlign: 'center',
              textDecoration: 'none',
              textShadow: '0 1px 4px rgba(0,0,0,0.25)',
              WebkitTapHighlightColor: 'transparent',
              transform: pressed ? 'scale(0.97)' : 'scale(1)',
              transition: 'transform 0.12s cubic-bezier(0.2, 0.65, 0.25, 1), box-shadow 0.18s ease',
              pointerEvents: 'auto',
              animation: 'ob-fade-up 0.35s ease-out',
            }}
          >
            Jetzt registrieren
          </Link>
        )}
      </div>
    </div>
  )
}
