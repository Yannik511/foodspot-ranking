import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { hapticFeedback } from '../utils/haptics'
import { springEasing } from '../utils/animations'

function CategoryGrid() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [isMounted, setIsMounted] = useState(false)

  const categories = [
    { emoji: '🥙', text: 'Beste Döner', gradient: 'linear-gradient(135deg, #FFE4C3 0%, #FFD4A3 100%)' },
    { emoji: '🍕', text: 'Pizza-Topliste', gradient: 'linear-gradient(135deg, #FFD4A3 0%, #FFC98A 100%)' },
    { emoji: '🍔', text: 'Burger-Ranking', gradient: 'linear-gradient(135deg, #FFC98A 0%, #FFB25A 100%)' },
    { emoji: '🍜', text: 'Asiatisch', gradient: 'linear-gradient(135deg, #FFB25A 0%, #FF9C68 100%)' },
    { emoji: '🥓', text: 'Bratwurst', gradient: 'linear-gradient(135deg, #FF9C68 0%, #FF8E53 100%)' },
    { emoji: '🍣', text: 'Sushi-Guide', gradient: 'linear-gradient(135deg, #FF8E53 0%, #FF7E42 100%)' },
  ]

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <div 
      className="w-full px-4"
      style={{ 
        marginTop: 'clamp(40px, 10vw, 48px)',
        paddingBottom: 'clamp(40px, 10vw, 48px)',
      }}
    >
      <div className="max-w-md mx-auto">
        <h4 
          className="text-center font-semibold mb-6"
          style={{
            color: isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(31, 41, 55, 0.95)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: 'clamp(18px, 4.5vw, 20px)',
            letterSpacing: '-0.01em',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'translateY(0)' : 'translateY(10px)',
            transition: `opacity 0.5s ${springEasing.default} 0.2s, transform 0.5s ${springEasing.gentle} 0.2s`,
          }}
        >
          Wähle dein erstes Food-Abenteuer 🍜
        </h4>
        
        <div 
          className="grid grid-cols-2 gap-3" 
          style={{ 
            gap: 'clamp(12px, 3vw, 16px)',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'translateY(0)' : 'translateY(10px)',
            transition: `opacity 0.5s ${springEasing.default} 0.3s, transform 0.5s ${springEasing.gentle} 0.3s`,
          }}
        >
          {categories.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                hapticFeedback.light()
                navigate('/select-category')
              }}
              onTouchStart={() => hapticFeedback.light()}
              className="relative rounded-[20px] shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-300 group overflow-hidden flex flex-col items-center justify-center"
              style={{
                background: isDark
                  ? `linear-gradient(135deg, rgba(255, 157, 104, 0.15) 0%, rgba(255, 126, 66, 0.2) 100%)`
                  : item.gradient,
                border: isDark
                  ? '1px solid rgba(255, 157, 104, 0.2)'
                  : '1px solid rgba(255, 126, 66, 0.1)',
                height: 'clamp(100px, 22vw, 120px)',
                minHeight: 'clamp(100px, 22vw, 120px)',
                maxHeight: 'clamp(100px, 22vw, 120px)',
                width: '100%',
                padding: 'clamp(16px, 4vw, 20px)',
                aspectRatio: '1 / 1',
                transform: 'translateY(0)',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: isDark
                  ? '0 4px 16px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)'
                  : '0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                e.currentTarget.style.boxShadow = isDark
                  ? '0 12px 32px rgba(0, 0, 0, 0.35), 0 4px 16px rgba(0, 0, 0, 0.2)'
                  : '0 12px 32px rgba(255, 152, 89, 0.3), 0 4px 16px rgba(255, 125, 66, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = isDark
                  ? '0 4px 16px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)'
                  : '0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)'
              }}
            >
              {/* Subtle overlay on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-[20px]"
                style={{
                  background: 'radial-gradient(circle at center, rgba(255, 125, 66, 0.3) 0%, transparent 70%)',
                }}
              />
              <div className="relative z-10 flex flex-col items-center justify-center gap-2 w-full h-full">
                <span 
                  className="flex-shrink-0"
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                    transform: 'scale(1)',
                    transition: 'transform 0.3s ease-out',
                    fontSize: 'clamp(28px, 7vw, 36px)',
                    lineHeight: '1',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15) rotate(5deg)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  {item.emoji}
                </span>
                <span 
                  className="font-semibold text-gray-800 dark:text-gray-100 text-sm text-center flex-shrink-0"
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 'clamp(13px, 3vw, 15px)',
                    fontWeight: 600,
                    lineHeight: '1.3',
                    wordBreak: 'break-word',
                    hyphens: 'auto',
                  }}
                >
                  {item.text}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CategoryGrid

