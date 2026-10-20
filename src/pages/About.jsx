import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { hapticFeedback } from '../utils/haptics'
import { useHeaderHeight, getContentPaddingTop } from '../hooks/useHeaderHeight'
import { useScrollHeader } from '../hooks/useScrollHeader'
import SubpageHeader from '../components/SubpageHeader'
import { APP_VERSION } from '../data/changelog'
import FeedbackSheet from '../components/FeedbackSheet'

// Gleiche Tier-Farben wie in den Listen (TierList.jsx)
const TIERS = [
  { tier: 'S', color: '#E53935' },
  { tier: 'A', color: '#FB8C00' },
  { tier: 'B', color: '#FDD835' },
  { tier: 'C', color: '#43A047' },
  { tier: 'D', color: '#1E88E5' },
]

const FEATURES = [
  { icon: '🏆', title: 'Tier-Listen', text: 'Ranke deine Spots von S bis D.' },
  { icon: '👥', title: 'Mit Freunden', text: 'Gemeinsame Listen, gemeinsame Bewertungen.' },
  { icon: '🧭', title: 'Entdecken', text: 'Top-Spots in deiner Nähe finden.' },
  { icon: '🌍', title: 'Weltkarte', text: 'Alle deine Orte auf einen Blick.' },
]

const STEPS = [
  { title: 'Liste anlegen', text: 'Burger, Pizza, Sushi – oder alles in einer.' },
  { title: 'Spots bewerten', text: 'Nach Kriterien bewerten – Rankify sortiert automatisch ins richtige Tier.' },
  { title: 'Teilen & vergleichen', text: 'Freunde einladen und sehen, wer recht hat.' },
]

const stagger = (i) => ({ animationDelay: `${80 + i * 50}ms`, animationFillMode: 'both' })

function SectionTitle({ children, isDark }) {
  return (
    <h3
      className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-xs font-semibold uppercase tracking-wider mb-3 px-1`}
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {children}
    </h3>
  )
}

function LinkRow({ label, icon, onClick, isDark, last }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:opacity-60 transition-opacity ${
        last ? '' : `border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`
      }`}
    >
      <span className="text-lg w-6 text-center" aria-hidden="true">{icon}</span>
      <span
        className={`flex-1 ${isDark ? 'text-gray-200' : 'text-gray-800'} font-medium`}
        style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
      >
        {label}
      </span>
      <svg className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

function About() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { headerRef, headerHeight } = useHeaderHeight()
  const scrollRef = useRef(null)
  const scrolled = useScrollHeader(scrollRef)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const handleBack = () => {
    hapticFeedback.light()
    navigate(-1)
  }

  const go = (path) => () => {
    hapticFeedback.light()
    navigate(path)
  }

  const card = `${isDark ? 'bg-gray-800' : 'bg-white'} rounded-3xl shadow-sm`

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'} relative overflow-hidden`}>
      <SubpageHeader
        headerRef={headerRef}
        title="Über Rankify"
        isDark={isDark}
        scrolled={scrolled}
        onBack={handleBack}
      />

      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: getContentPaddingTop(headerHeight, 0),
          paddingBottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="px-4 max-w-2xl mx-auto">
          {/* Hero */}
          <section className="relative flex flex-col items-center text-center pt-2 pb-8">
            {/* Orange Glow hinter dem Icon */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 260,
                height: 260,
                top: -30,
                background: 'radial-gradient(circle, rgba(255,126,66,0.35) 0%, rgba(255,126,66,0) 70%)',
                filter: 'blur(8px)',
              }}
              aria-hidden="true"
            />
            <img
              src="/app-icon.svg"
              alt=""
              className="relative animate-scale-in"
              style={{
                width: 104,
                height: 104,
                borderRadius: 24,
                boxShadow: '0 18px 40px -10px rgba(234,144,83,0.65)',
              }}
            />
            <h2
              className={`relative mt-5 ${isDark ? 'text-white' : 'text-gray-900'} animate-fade-slide-up`}
              style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', ...stagger(0) }}
            >
              Rankify
            </h2>
            <p
              className={`relative mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'} animate-fade-slide-up`}
              style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, ...stagger(1) }}
            >
              Deine Lieblingsspots. Dein Ranking.
            </p>
            <span
              className={`relative mt-3 px-3 py-1 rounded-full text-xs font-semibold animate-fade-slide-up ${
                isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 shadow-sm'
              }`}
              style={{ fontFamily: "'Poppins', sans-serif", ...stagger(2) }}
            >
              Version {APP_VERSION}
            </span>

            {/* Mini-Tier-Leiste */}
            <div className="relative flex gap-2 mt-6" aria-hidden="true">
              {TIERS.map(({ tier, color }, i) => (
                <div
                  key={tier}
                  className="flex items-center justify-center rounded-xl text-white font-extrabold animate-scale-in"
                  style={{
                    width: 40,
                    height: 40,
                    background: color,
                    boxShadow: `0 6px 14px -6px ${color}`,
                    fontFamily: "'Poppins', sans-serif",
                    ...stagger(3 + i),
                  }}
                >
                  {tier}
                </div>
              ))}
            </div>
          </section>

          {/* Was Rankify kann */}
          <SectionTitle isDark={isDark}>Was Rankify kann</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`${card} p-4 animate-fade-slide-up`} style={stagger(4 + i)}>
                <div
                  className="flex items-center justify-center rounded-2xl text-xl mb-3"
                  style={{ width: 42, height: 42, background: isDark ? 'rgba(255,126,66,0.14)' : 'rgba(255,126,66,0.10)' }}
                  aria-hidden="true"
                >
                  {f.icon}
                </div>
                <p
                  className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}
                  style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
                >
                  {f.title}
                </p>
                <p
                  className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm mt-0.5`}
                  style={{ fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }}
                >
                  {f.text}
                </p>
              </div>
            ))}
          </div>

          {/* So funktioniert's */}
          <div className="mt-8">
            <SectionTitle isDark={isDark}>So funktioniert&apos;s</SectionTitle>
            <div className={`${card} p-5`}>
              <ol className="space-y-4">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex items-start gap-3">
                    <span
                      className="flex items-center justify-center shrink-0 rounded-full text-white text-sm font-bold"
                      style={{
                        width: 30,
                        height: 30,
                        background: 'linear-gradient(135deg, #FF7E42, #FFB25A)',
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      {i + 1}
                    </span>
                    <div className="pt-0.5">
                      <p
                        className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}
                        style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
                      >
                        {s.title}
                      </p>
                      <p
                        className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm`}
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        {s.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Mehr */}
          <div className="mt-8">
            <SectionTitle isDark={isDark}>Mehr</SectionTitle>
            <div className={`${card} overflow-hidden`}>
              <LinkRow icon="✨" label="Neuigkeiten" onClick={go('/changelog')} isDark={isDark} />
              <LinkRow
                icon="💬"
                label="Feedback senden"
                onClick={() => { hapticFeedback.light(); setFeedbackOpen(true) }}
                isDark={isDark}
                last
              />
            </div>
          </div>

          {/* Rechtliches */}
          <div className="mt-6">
            <SectionTitle isDark={isDark}>Rechtliches</SectionTitle>
            <div className={`${card} overflow-hidden`}>
              <LinkRow icon="🔒" label="Datenschutzerklärung" onClick={go('/privacy')} isDark={isDark} />
              <LinkRow icon="📄" label="Nutzungsbedingungen" onClick={go('/terms')} isDark={isDark} />
              <LinkRow icon="ℹ️" label="Impressum" onClick={go('/impressum')} isDark={isDark} last />
            </div>
          </div>

          <p
            className={`text-center text-sm mt-10 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Mit viel Hunger gemacht 🍔
            <br />
            © 2026 Rankify
          </p>
        </div>
      </main>

      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  )
}

export default About
