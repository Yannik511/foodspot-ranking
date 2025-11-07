import { View, Text, Pressable, ImageBackground, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

function Landing() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      console.log('User is logged in, redirecting to Dashboard:', user.email)
      router.replace('/(tabs)/dashboard')
    } else if (!loading && !user) {
      console.log('No user found, showing Landing page')
    }
  }, [user, loading, router])

  if (loading) {
    return null
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1920&q=80' }}
        style={styles.backgroundImage}
        imageStyle={{ opacity: 0.9 }}
      >
        {/* Gradient Overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.5)']}
          style={styles.gradientOverlay}
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Foodspot Ranker</Text>
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.loginButton,
                pressed === true ? styles.buttonPressed : null,
              ]}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.buttonText}>Login</Text>
            </Pressable>

            <View style={{ width: 12 }} />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.signUpButton,
                pressed === true ? styles.buttonPressed : null,
              ]}
              onPress={() => router.push('/(auth)/register')}
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF8E53', '#FF6B9D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Text style={styles.buttonText}>Sign Up</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  title: {
    fontSize: 48,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 30,
    letterSpacing: -0.5,
  },
  spacer: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingBottom: 24,
  },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  loginButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  signUpButton: {
    overflow: 'hidden',
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
})

export default Landing

