import { View, Text, StyleSheet, Pressable, Image } from 'react-native'
import { useAuth } from '../contexts/AuthContext'

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

function Avatar({ 
  size = 40, 
  onPress, 
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
  
  const imageUrl = profileImageUrl 
    ? `${profileImageUrl}${cacheBust ? `?v=${cacheBust}` : ''}`
    : null
  
  const avatarSize = typeof size === 'number' ? size : 40
  const borderRadius = shape === 'square' ? 20 : avatarSize / 2

  const avatarContent = (
    <View
      style={[
        styles.avatar,
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: borderRadius,
          backgroundColor: imageUrl ? 'transparent' : backgroundColor,
        },
        showBorder && styles.border,
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: borderRadius,
            },
          ]}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            {
              fontSize: avatarSize * 0.4,
            },
          ]}
        >
          {getInitials()}
        </Text>
      )}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          pressed === true && styles.pressed,
        ]}
      >
        {avatarContent}
      </Pressable>
    )
  }

  return avatarContent
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  border: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
})

export default Avatar

