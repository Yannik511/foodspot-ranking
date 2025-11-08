import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { hapticFeedback } from '../utils/haptics'

function About() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  
  const handleBack = () => {
    hapticFeedback.light()
    navigate(-1)
  }
  
  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'} border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between sticky top-0 z-10`}
        style={{
          paddingLeft: 'clamp(16px, 4vw, 24px)',
          paddingRight: 'clamp(16px, 4vw, 24px)',
          paddingTop: `calc(clamp(12px, 3vh, 16px) + env(safe-area-inset-top))`,
          paddingBottom: 'clamp(12px, 3vh, 16px)',
          minHeight: `calc(60px + env(safe-area-inset-top))`,
        }}
      >
        <button
          onClick={handleBack}
          className="flex items-center justify-center"
          style={{
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
          }}
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
          Über Rankify
        </h1>
        
        <div style={{ width: '44px', height: '44px' }} />
      </header>
      
      {/* Content */}
      <main className="px-4 py-8 max-w-2xl mx-auto">
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-sm`}>
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🍔</div>
            <h2 
              className={`${isDark ? 'text-white' : 'text-gray-900'} text-3xl font-bold mb-2`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Rankify
            </h2>
            <p 
              className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Version 1.0.0
            </p>
          </div>
          
          <div className={`space-y-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <p style={{ fontFamily: "'Inter', sans-serif", lineHeight: '1.6' }}>
              Rankify ist deine persönliche Foodspot-Ranking-App. Erstelle Listen deiner Lieblingsrestaurants, 
              bewerte sie und teile sie mit Freunden.
            </p>
            
            <div className={`pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 
                className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold mb-2`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Features
              </h3>
              <ul className="space-y-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF7E42]">•</span>
                  <span>Persönliche Foodspot-Listen erstellen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF7E42]">•</span>
                  <span>Foodspots nach Tier-Ranking organisieren</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF7E42]">•</span>
                  <span>Listen mit Freunden teilen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF7E42]">•</span>
                  <span>Dark Mode Support</span>
                </li>
              </ul>
            </div>
            
            <div className={`pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <p 
                className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                © 2024 Rankify. Alle Rechte vorbehalten.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default About

