import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useSocialNotifications } from '../hooks/useSocialNotifications'
import { hapticFeedback } from '../utils/haptics'

const TAB_PATHS = ['/dashboard', '/social', '/account']

function IconHome({ active, color }) {
  return active ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color}>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9" /><path d="M9 21V12h6v9" /><path d="M3 12v9h5V12m8 0v9h5V12" />
    </svg>
  )
}

function IconSocial({ active, color }) {
  return active ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color}>
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IconProfile({ active, color }) {
  return active ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color}>
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

const TABS = [
  { path: '/dashboard', label: 'Home',   Icon: IconHome    },
  { path: '/social',    label: 'Social',  Icon: IconSocial  },
  { path: '/account',   label: 'Profil',  Icon: IconProfile },
]

export function isTabBarPage(pathname) {
  return TAB_PATHS.includes(pathname)
}

export default function BottomTabBar() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const hasSocialNotifications = useSocialNotifications()

  const activeColor = isDark ? '#FF9357' : '#FF7E42'
  const inactiveColor = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.32)'

  const glassStyle = isDark ? {
    background: 'rgba(20, 20, 24, 0.58)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.50), 0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
  } : {
    background: 'rgba(255,255,255,0.52)',
    border: '1px solid rgba(255,255,255,0.80)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)',
  }

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        borderRadius: '999px',
        backdropFilter: 'blur(48px) saturate(200%)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%)',
        display: 'flex',
        alignItems: 'center',
        padding: '6px',
        gap: '0px',
        width: 'min(92vw, 340px)',
        ...glassStyle,
      }}
    >
      {TABS.map(({ path, label, Icon }) => {
        const isActive = location.pathname === path
        const isNotif = path === '/social' && hasSocialNotifications
        return (
          <button
            key={path}
            onClick={() => { hapticFeedback.light(); navigate(path) }}
            onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.90)' }}
            onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)' }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '8px 4px',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              minHeight: '54px',
              background: isActive
                ? (isDark ? 'rgba(255,147,87,0.15)' : 'rgba(255,126,66,0.10)')
                : 'transparent',
              transition: 'background 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
            }}
          >
            <span style={{ position: 'relative', display: 'flex' }}>
              <Icon active={isActive} color={isActive ? activeColor : inactiveColor} />
              {isNotif && (
                <span style={{
                  position: 'absolute', top: '-2px', right: '-4px',
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: '#FF3B30',
                  border: isDark ? '1.5px solid rgba(20,20,24,0.9)' : '1.5px solid rgba(255,255,255,0.9)',
                }} />
              )}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: '600',
              fontFamily: "'Poppins', sans-serif",
              color: isActive ? activeColor : inactiveColor,
              transition: 'color 0.2s ease',
              letterSpacing: '0.01em',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
