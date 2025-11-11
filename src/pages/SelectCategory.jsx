import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

// Kategorien-Definition (gleiche wie in AddFoodspot)
const CATEGORIES = {
  'Döner': {
    emoji: '🥙',
    description: 'Beste Döner-Spots bewerten',
    color: '#FF7E42'
  },
  'Burger': {
    emoji: '🍔',
    description: 'Burger-Ranking erstellen',
    color: '#FFB25A'
  },
  'Pizza': {
    emoji: '🍕',
    description: 'Pizza-Topliste',
    color: '#FF9C68'
  },
  'Asiatisch': {
    emoji: '🍜',
    description: 'Asiatische Küche',
    color: '#FF7E42'
  },
  Bratwurst: {
    emoji: '🥓',
    description: 'Bewerte die besten Bratwurst-Stände – von fränkisch bis Currywurst.',
    color: '#FFB25A'
  },
  Glühwein: {
    emoji: '🍷',
    description: 'Glühwein-Stände bewerten',
    color: '#FF9C68'
  },
  Sushi: {
    emoji: '🍣',
    description: 'Sushi-Restaurants vergleichen',
    color: '#FF7E42'
  },
  Steak: {
    emoji: '🥩',
    description: 'Steakhäuser & Cuts bewerten',
    color: '#FF9C68'
  },
  'Fast Food': {
    emoji: '🍔',
    description: 'Bester Fast-Food-Spot in deiner Stadt',
    color: '#FFB25A'
  },
  Streetfood: {
    emoji: '🌯',
    description: 'Streetfood-Märkte & Trucks bewerten',
    color: '#FF7E42'
  },
  'Deutsche Küche': {
    emoji: '🥨',
    description: 'Bewerte klassische Gerichte der deutschen Küche.',
    color: '#FF9C68'
  },
  Bier: {
    emoji: '🍺',
    description: 'Bewerte verschiedene Biersorten – vom Hellen bis zum Craft Beer.',
    color: '#FFB25A'
  }
}

function SelectCategory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDark } = useTheme()
  const [selectedCategory, setSelectedCategory] = useState(null)

  const handleCategorySelect = (category) => {
    // Navigate to CreateList with category parameter
    navigate(`/create-list?category=${encodeURIComponent(category)}`)
  }

  const handleAllCategories = () => {
    // Navigate without category (null = all categories)
    navigate('/create-list?category=all')
  }

  return (
    <div className={`min-h-screen flex flex-col ${
      isDark 
        ? 'bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-b from-white via-[#FFF2EB] to-white'
    }`}>
      {/* Header */}
      <header className={`backdrop-blur-[12px] border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10 ${
        isDark
          ? 'bg-gray-800/70 border-gray-700/30'
          : 'bg-white/70 border-gray-200/30'
      }`}>
        <button
          onClick={() => navigate('/dashboard')}
          className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
            isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
          }`}
        >
          <svg className={`w-6 h-6 ${isDark ? 'text-gray-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 className={`text-lg font-bold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`} style={{ fontFamily: "'Poppins', sans-serif" }}>
          Kategorie auswählen
        </h1>

        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <div className="text-center mb-8">
            <h2 
              className={`text-2xl font-bold mb-3 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Welche Kategorie möchtest du für deine Liste auswählen?
            </h2>
            <p className={`text-sm ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              Wähle eine spezifische Kategorie oder alle Kategorien für deine Liste
            </p>
          </div>

          {/* All Categories Option */}
          <div className="mb-6">
            <button
              onClick={handleAllCategories}
              className="w-full bg-gradient-to-r from-[#FF7E42] to-[#FFB25A] hover:from-[#FF9357] hover:to-[#FFB25A] rounded-[20px] p-6 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center gap-4 group dark:from-[#FF9357] dark:to-[#B85C2C]"
              style={{
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-sm">
                ➕
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-white text-lg mb-1">Alle Kategorien</h3>
                <p className="text-white/90 text-sm">
                  Erstelle eine Liste mit Foodspots aller Kategorien – maximale Flexibilität
                </p>
              </div>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(CATEGORIES).map(([category, { emoji, description, color }]) => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                className={`rounded-[20px] p-5 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center gap-4 group border-2 ${
                  isDark
                    ? selectedCategory === category
                      ? 'bg-gray-800 border-[#FF9357] bg-gradient-to-br from-[#FF9357]/10 to-[#B85C2C]/10'
                      : 'bg-gray-800 border-gray-700 hover:border-[#FF9357]/40'
                    : selectedCategory === category
                      ? 'bg-white border-[#FF7E42] bg-gradient-to-br from-[#FF7E42]/5 to-[#FFB25A]/5'
                      : 'bg-white border-gray-100 hover:border-[#FF7E42]/30'
                }`}
                style={{
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 transition-all group-hover:scale-110"
                  style={{
                    background: isDark
                      ? `linear-gradient(135deg, ${color}20 0%, ${color}30 100%)`
                      : `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`,
                  }}
                >
                  {emoji}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h3 className={`font-bold text-base mb-1 truncate ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>{category}</h3>
                  <p className={`text-xs leading-tight ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>{description}</p>
                </div>
                <svg className={`w-5 h-5 transition-colors flex-shrink-0 ${
                  isDark
                    ? 'text-gray-400 group-hover:text-[#FF9357]'
                    : 'text-gray-400 group-hover:text-[#FF7E42]'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default SelectCategory



