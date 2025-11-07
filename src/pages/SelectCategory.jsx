import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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
  'Mexikanisch': {
    emoji: '🌮',
    description: 'Mexikanische Gerichte',
    color: '#FFB25A'
  },
  'Glühwein': {
    emoji: '🍷',
    description: 'Glühwein-Stände bewerten',
    color: '#FF9C68'
  },
  'Sushi': {
    emoji: '🍣',
    description: 'Sushi-Restaurants',
    color: '#FF7E42'
  },
  'Dessert': {
    emoji: '🍦',
    description: 'Desserts & Süßes',
    color: '#FFB25A'
  },
  'Vegan/Healthy': {
    emoji: '🥗',
    description: 'Gesunde & vegane Optionen',
    color: '#FF9C68'
  }
}

function SelectCategory() {
  const navigate = useNavigate()
  const { user } = useAuth()
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
    <div className="min-h-screen bg-gradient-to-b from-white via-[#FFF2EB] to-white flex flex-col">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-[12px] border-b border-gray-200/30 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
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
              className="text-2xl font-bold text-gray-900 mb-3"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Welche Kategorie möchtest du für deine Liste auswählen?
            </h2>
            <p className="text-gray-600 text-sm">
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
                className={`bg-white rounded-[20px] p-5 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center gap-4 group border-2 ${
                  selectedCategory === category 
                    ? 'border-[#FF7E42] bg-gradient-to-br from-[#FF7E42]/5 to-[#FFB25A]/5' 
                    : 'border-gray-100 hover:border-[#FF7E42]/30'
                }`}
                style={{
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 transition-all group-hover:scale-110"
                  style={{
                    background: `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`,
                  }}
                >
                  {emoji}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-bold text-gray-900 text-base mb-1 truncate">{category}</h3>
                  <p className="text-gray-600 text-xs leading-tight">{description}</p>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-[#FF7E42] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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



