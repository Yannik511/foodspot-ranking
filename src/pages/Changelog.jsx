import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { hapticFeedback } from '../utils/haptics'
import { useHeaderHeight, getContentPaddingTop } from '../hooks/useHeaderHeight'
import { useScrollHeader } from '../hooks/useScrollHeader'
import SubpageHeader from '../components/SubpageHeader'
import { CHANGELOG } from '../data/changelog'

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

// Gestaffeltes Einblenden der Karten/Zeilen
const stagger = (i) => ({ animationDelay: `${80 + i * 45}ms`, animationFillMode: 'both' })

function FeatureRow({ item, isDark, index }) {
  return (
    <li className="flex items-start gap-3 animate-fade-slide-up" style={stagger(index)}>
      <div
        className="flex items-center justify-center shrink-0 rounded-2xl text-xl"
        style={{
          width: 44,
          height: 44,
          background: isDark ? 'rgba(255,126,66,0.14)' : 'rgba(255,126,66,0.10)',
        }}
        aria-hidden="true"
      >
        {item.icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <p
          className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}
          style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15 }}
        >
          {item.title}
        </p>
        <p
          className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm mt-0.5`}
          style={{ fontFamily: "'Inter', sans-serif", lineHeight: 1.45 }}
        >
          {item.text}
        </p>
      </div>
    </li>
  )
}

function Changelog() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { headerRef, headerHeight } = useHeaderHeight()
  const scrollRef = useRef(null)
  const scrolled = useScrollHeader(scrollRef)

  const [latest, ...older] = CHANGELOG

  const handleBack = () => {
    hapticFeedback.light()
    navigate(-1)
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'} relative overflow-hidden`}>
      <SubpageHeader
        headerRef={headerRef}
        title="Neuigkeiten"
        isDark={isDark}
        scrolled={scrolled}
        onBack={handleBack}
      />

      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: getContentPaddingTop(headerHeight, 8),
          paddingBottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="px-4 max-w-2xl mx-auto">
          <h1
            className={`${isDark ? 'text-white' : 'text-gray-900'} animate-fade-slide-up`}
            style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em' }}
          >
            Neuigkeiten
          </h1>
          <p
            className={`${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1 mb-5 animate-fade-slide-up`}
            style={{ fontFamily: "'Inter', sans-serif", ...stagger(0) }}
          >
            Was sich in Rankify getan hat.
          </p>

          {/* Aktuelle Version als Hero-Karte */}
          <section
            className="relative overflow-hidden rounded-3xl p-6 text-white animate-scale-in"
            style={{
              background: 'linear-gradient(135deg, #FF7E42 0%, #FFB25A 100%)',
              boxShadow: '0 18px 40px -12px rgba(255,126,66,0.55)',
            }}
          >
            {/* Deko-Kreise */}
            <div
              className="absolute rounded-full"
              style={{ width: 220, height: 220, right: -70, top: -90, background: 'rgba(255,255,255,0.16)' }}
              aria-hidden="true"
            />
            <div
              className="absolute rounded-full"
              style={{ width: 120, height: 120, right: 40, bottom: -70, background: 'rgba(255,255,255,0.10)' }}
              aria-hidden="true"
            />

            <div className="relative">
              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-bold tracking-wide"
                  style={{ background: 'rgba(255,255,255,0.25)', fontFamily: "'Poppins', sans-serif" }}
                >
                  NEU
                </span>
                <span className="text-sm opacity-90" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {formatDate(latest.date)}
                </span>
              </div>
              <p
                className="mt-4 opacity-90 text-sm font-semibold"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Version {latest.version}
              </p>
              <h2
                style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 26, lineHeight: 1.15 }}
              >
                {latest.title}
              </h2>
              {latest.intro && (
                <p className="mt-2 text-[15px] opacity-95" style={{ fontFamily: "'Inter', sans-serif", lineHeight: 1.45 }}>
                  {latest.intro}
                </p>
              )}
            </div>
          </section>

          {/* Neuerungen der aktuellen Version */}
          <section className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-3xl p-5 mt-4 shadow-sm`}>
            <ul className="space-y-4">
              {latest.items.map((item, i) => (
                <FeatureRow key={item.title} item={item} isDark={isDark} index={i} />
              ))}
            </ul>
          </section>

          {/* Frühere Versionen als Zeitleiste */}
          {older.length > 0 && (
            <section className="mt-8">
              <h3
                className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-xs font-semibold uppercase tracking-wider mb-3 px-1`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Frühere Versionen
              </h3>
              <ol className={`relative border-l-2 ml-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                {older.map((entry) => (
                  <li key={entry.version} className="pl-5 pb-6 relative">
                    <span
                      className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}
                      aria-hidden="true"
                    />
                    <p
                      className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      Version {entry.version} · {entry.title}
                    </p>
                    <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-xs mb-2`}>
                      {formatDate(entry.date)}
                    </p>
                    <ul className={`space-y-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {entry.items.map((item) => (
                        <li key={item.title}>
                          <span aria-hidden="true">{item.icon}</span> <strong>{item.title}:</strong> {item.text}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default Changelog
