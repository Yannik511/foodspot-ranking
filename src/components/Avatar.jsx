import { useAuth } from '../contexts/AuthContext'

// Generate deterministic color from user ID
const getColorFromId = (userId) => {
  if (!userId) return '#FF7E42'
  
  // Simple hash function
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  // Generate pastel colors with good contrast - warm food-inspired palette
  const colors = [
    '#FF7E42', '#FFB25A', '#FF9C68', // Warm orange/honey tones
    '#FFE4C3', '#FFD4A3', '#FFC98A', // Creamy accent tones
    '#4A90E2', '#6BA3E3', '#8CB6E4', // Blue tones
    '#7ED321', '#8FD63F', '#A0E65C', // Green tones
    '#F5A623', '#F7B84D', '#F9CA77', // Yellow tones
    '#9013FE', '#A644FF', '#BC75FF', // Purple tones
    '#FF6B9D', '#FF8AB5', '#FFA9CD', // Pink tones
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

function Avatar({ 
  size = 40, 
  onClick, 
  className = '',
  showBorder = true,
  cacheBust = null,
  shape = 'circle' // 'circle' or 'square'
}) {
  const { user } = useAuth()
  
  const getUsername = () => {
    return user?.user_metadata?.username || user?.email?.split('@')[0] || 'U'
  }

  const getInitials = () => {
    return getUsername().charAt(0).toUpperCase()
  }
  
  const profileImageUrl = user?.user_metadata?.profileImageUrl
  const backgroundColor = getColorFromId(user?.id)
  
  // Add cache busting if provided
  const imageUrl = profileImageUrl 
    ? `${profileImageUrl}${cacheBust ? `?v=${cacheBust}` : ''}`
    : null
  
  // Responsive sizing: if size is "responsive", use fluid sizing
  // Otherwise use fixed pixel size
  const avatarStyle = size === 'responsive' 
    ? {
        width: '100%',
        height: '100%',
        minWidth: '100%',
        minHeight: '100%',
      }
    : {
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
      }
  
  const borderRadius = shape === 'square' ? '20px' : '50%'
  
  const Component = onClick ? 'button' : 'div'
  
  return (
    <Component
      onClick={onClick}
      className={`overflow-hidden flex items-center justify-center font-semibold text-white transition-all ${onClick ? 'active:scale-95 cursor-pointer' : ''} ${className}`}
      style={{
        ...avatarStyle,
        borderRadius: borderRadius,
        backgroundColor: imageUrl ? 'transparent' : backgroundColor,
        border: showBorder ? '1px solid rgba(255, 255, 255, 0.4)' : 'none',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }}
      aria-label={onClick ? "Öffne Account & Einstellungen" : undefined}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={getUsername()}
          className="w-full h-full object-cover"
          style={{ objectFit: 'cover' }}
          onError={(e) => {
            // Fallback to initials if image fails to load
            e.target.style.display = 'none'
            e.target.parentElement.style.backgroundColor = backgroundColor
            const initials = e.target.parentElement.querySelector('.avatar-initials')
            if (initials) initials.style.display = 'flex'
          }}
        />
      ) : null}
      <span 
        className="avatar-initials"
        style={{ 
          display: imageUrl ? 'none' : 'flex',
          fontSize: size === 'responsive' 
            ? 'clamp(18px, 1.35vw, 26px)'
            : `${size * 0.45}px`,
          lineHeight: size === 'responsive' ? '100%' : `${size}px`,
        }}
      >
        {getInitials()}
      </span>
    </Component>
  )
}

export default Avatar

