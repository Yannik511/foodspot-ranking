import { glassHeaderStyle } from '../lib/glass'

// Schlichte Kopfzeile für Unterseiten (Über Rankify, Neuigkeiten):
// Zurück-Pfeil + Titel, transparent am Seitenanfang, Glas beim Scrollen.
// Der Titel blendet erst ein, wenn gescrollt wurde — oben trägt die Hero-Fläche ihn.
function SubpageHeader({ headerRef, title, isDark, scrolled, onBack }) {
  return (
    <header
      ref={headerRef}
      className="header-safe flex items-center justify-between fixed top-0 left-0 right-0 z-10"
      style={{
        ...glassHeaderStyle(isDark, scrolled),
        paddingLeft: 'clamp(16px, 4vw, 24px)',
        paddingRight: 'clamp(16px, 4vw, 24px)',
      }}
    >
      <button
        onClick={onBack}
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
          opacity: scrolled ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      >
        {title}
      </h1>

      <div style={{ width: '44px', height: '44px' }} />
    </header>
  )
}

export default SubpageHeader
