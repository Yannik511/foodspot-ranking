import { useTheme } from '../contexts/ThemeContext'

export default function Discover() {
  const { isDark } = useTheme()

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
      background: isDark ? '#0f0f13' : '#f5f5f7',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        opacity: 0.5,
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke={isDark ? '#fff' : '#000'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
        <span style={{
          fontSize: '15px',
          fontWeight: '600',
          fontFamily: "'Poppins', sans-serif",
          color: isDark ? '#fff' : '#000',
        }}>
          Coming Soon
        </span>
      </div>
    </div>
  )
}
