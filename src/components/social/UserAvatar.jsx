import { useEffect, useMemo } from 'react'
import { useProfilesStore } from '../../contexts/ProfileContext'

// Generate deterministic color from user ID
const getColorFromId = (userId) => {
  if (!userId) return '#FF7E42'
  
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    '#FF7E42', '#FFB25A', '#FF9C68',
    '#FFE4C3', '#FFD4A3', '#FFC98A',
    '#4A90E2', '#6BA3E3', '#8CB6E4',
    '#7ED321', '#8FD63F', '#A0E65C',
    '#F5A623', '#F7B84D', '#F9CA77',
    '#9013FE', '#A644FF', '#BC75FF',
    '#FF6B9D', '#FF8AB5', '#FFA9CD',
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

function UserAvatar({ user, size = 40, className = '', showBorder = true }) {
  const { ensureProfiles, getProfile } = useProfilesStore()
  const userId = user?.id || user?.user_id

  useEffect(() => {
    if (userId) {
      ensureProfiles([userId])
    }
  }, [userId, ensureProfiles])

  const profileFromStore = useMemo(() => getProfile(userId), [getProfile, userId])
  const backgroundColor = useMemo(() => getColorFromId(userId), [userId])
  
  const profileImageUrl = profileFromStore?.avatar_url || user?.user_metadata?.profileImageUrl || user?.profileImageUrl
  const displayName = profileFromStore?.username || user?.user_metadata?.username || user?.username

  const getUsername = () => {
    return displayName || user?.email?.split('@')[0] || 'U'
  }

  const getInitials = () => {
    return getUsername().charAt(0).toUpperCase()
  }
  
  return (
    <div
      className={`overflow-hidden flex items-center justify-center font-semibold text-white ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: '50%',
        backgroundColor: profileImageUrl ? 'transparent' : backgroundColor,
        border: showBorder ? '1px solid rgba(255, 255, 255, 0.4)' : 'none',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }}
    >
      {profileImageUrl ? (
        <img
          src={profileImageUrl}
          alt={displayName || getUsername()}
          className="w-full h-full object-cover"
          style={{ objectFit: 'cover' }}
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.parentElement.style.backgroundColor = backgroundColor
          }}
        />
      ) : (
        <span
          style={{
            fontSize: `${size * 0.45}px`,
            lineHeight: `${size}px`,
          }}
        >
          {getInitials()}
        </span>
      )}
    </div>
  )
}

export default UserAvatar





