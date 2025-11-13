import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({})

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  // Load theme from localStorage or default to 'system'
  const [darkMode, setDarkModeState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode')
      if (saved) {
        return saved // 'system' | 'light' | 'dark'
      }
    }
    return 'system'
  })

  // Calculate actual dark mode state (system preference or explicit)
  const [isDark, setIsDark] = useState(() => {
    if (darkMode === 'dark') return true
    if (darkMode === 'light') return false
    // System mode
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  // Update isDark when darkMode changes
  useEffect(() => {
    if (darkMode === 'dark') {
      setIsDark(true)
    } else if (darkMode === 'light') {
      setIsDark(false)
    } else {
      // System mode - check preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      setIsDark(mediaQuery.matches)
      
      // Listen for system preference changes
      const handleChange = (e) => {
        setIsDark(e.matches)
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [darkMode])

  // Apply dark class to document element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [isDark])

  // Save to localStorage when darkMode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', darkMode)
    }
  }, [darkMode])

  const setDarkMode = (mode) => {
    setDarkModeState(mode)
  }

  const value = {
    darkMode, // 'system' | 'light' | 'dark'
    isDark, // boolean - actual dark state
    setDarkMode,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}









