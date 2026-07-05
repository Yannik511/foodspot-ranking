import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { hapticFeedback } from '../utils/haptics'
import { useHeaderHeight, getContentPaddingTop } from '../hooks/useHeaderHeight'
import { LEGAL } from '../data/legal'

function Legal({ docKey }) {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { headerRef, headerHeight } = useHeaderHeight()

  const doc = LEGAL[docKey]

  const handleBack = () => {
    hapticFeedback.light()
    navigate(-1)
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'} relative overflow-hidden`}>
      {/* Header */}
      <header
        ref={headerRef}
        className={`header-safe shadow-sm backdrop-blur-xl border-b flex items-center justify-between fixed top-0 left-0 right-0 z-10 ${
          isDark ? 'bg-gray-900/80 border-gray-800/50' : 'bg-white/80 border-gray-200/50'
        }`}
        style={{
          paddingLeft: 'clamp(16px, 4vw, 24px)',
          paddingRight: 'clamp(16px, 4vw, 24px)'
        }}
      >
        <button
          onClick={handleBack}
          className="flex items-center justify-center"
          style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px' }}
          aria-label="Zurück"
        >
          <svg
            className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1
          className={`${isDark ? 'text-white' : 'text-gray-900'} flex-1 text-center px-2`}
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(16px, 4vw, 18px)',
            lineHeight: '1.2',
          }}
        >
          {doc?.title}
        </h1>

        <div style={{ width: '44px', height: '44px' }} />
      </header>

      {/* Content */}
      <main
        className="flex-1 overflow-y-auto px-4 max-w-2xl mx-auto"
        style={{
          paddingTop: getContentPaddingTop(headerHeight, 24),
          paddingBottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-sm`}>
          {doc?.updated && (
            <p
              className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Stand: {doc.updated}
            </p>
          )}

          <div className={`space-y-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {doc?.sections.map((section, i) => (
              <section key={i}>
                <h2
                  className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold mb-2`}
                  style={{ fontFamily: "'Poppins', sans-serif", fontSize: '16px' }}
                >
                  {section.heading}
                </h2>
                {section.paragraphs?.map((p, j) => (
                  <p
                    key={j}
                    className="mb-2"
                    style={{ fontFamily: "'Inter', sans-serif", lineHeight: '1.6', fontSize: '14px' }}
                  >
                    {p}
                  </p>
                ))}
                {section.list && (
                  <ul className="space-y-2 mt-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {section.list.map((item, k) => (
                      <li key={k} className="flex items-start gap-2" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                        <span className="text-[#FF7E42] mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Legal
