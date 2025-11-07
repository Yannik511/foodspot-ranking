import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef } from 'react'

function WelcomeCard({ username, onCreateList, isCompact = false, foodEmoji = null }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={['#FFB25A', '#FF9C68', '#FF7E42']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.content}>
          {/* App Logo */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.logoBackground}>
              <Text style={styles.logoEmoji}>🍔</Text>
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {username}'s Foodspot Ranker
          </Animated.Text>

          {/* Subtext */}
          <Animated.Text
            style={[
              styles.subtitle,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            Finde die besten Foodspots deiner Stadt – bewertet von echten Genießern.
          </Animated.Text>

          {/* Primary Button */}
          {!isCompact && (
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
              }}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed === true ? styles.buttonPressed : null,
                ]}
                onPress={onCreateList}
              >
                <Text style={styles.buttonIcon}>
                  {foodEmoji || '+'}
                </Text>
                <View style={{ width: 8 }} />
                <Text style={styles.buttonText}>Starte deine erste Foodspot-Liste</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 48,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#FF7E42',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation: 8,
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoBackground: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF7E42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  logoEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#5C5C5C',
    marginBottom: 24,
    textAlign: 'center',
    maxWidth: '80%',
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#FF7E42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
})

export default WelcomeCard

