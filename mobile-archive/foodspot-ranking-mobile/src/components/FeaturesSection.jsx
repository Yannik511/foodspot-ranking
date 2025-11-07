import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = SCREEN_WIDTH * 0.9
const CARD_GAP = 16

const features = [
  {
    id: 1,
    icon: '⭐',
    title: 'Bewerte deine Lieblingsspots',
    description: 'Finde und bewerte die besten Döner, Pizzen & Co in deiner Stadt – ehrlich, einfach, persönlich.',
    color: '#FF7E42',
  },
  {
    id: 2,
    icon: '🧾',
    title: 'Erstelle deine eigenen Rankings',
    description: 'Baue Foodspot-Listen, wie du willst – Döner-S-Tier oder Sushi-B-Tier – alles ist möglich.',
    color: '#FFB25A',
  },
  {
    id: 3,
    icon: '📍',
    title: 'Entdecke die Besten in deiner Nähe',
    description: 'Sobald du den Standort aktivierst, zeigt dir die App automatisch die Top-Bewertungen deiner Stadt.',
    color: '#FF9C68',
  },
  {
    id: 4,
    icon: '🤝',
    title: 'Teile & vergleiche mit Freunden',
    description: 'Lass deine Freunde sehen, wo du am liebsten isst – oder finde neue Empfehlungen von echten Genießern.',
    color: '#FF7E42',
  },
  {
    id: 5,
    icon: '📊',
    title: 'Dein Geschmack, deine Statistik',
    description: 'Verfolge, was du am meisten isst, welche Küche du bevorzugst und wie sich deine Rankings verändern.',
    color: '#FFB25A',
  },
]

function FeatureCard({ feature, isActive }) {
  return (
    <View
      style={[
        styles.featureCard,
        isActive === true && styles.featureCardActive,
      ]}
    >
      <LinearGradient
        colors={[`${feature.color}15`, `${feature.color}25`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconContainer}
      >
        <Text style={[styles.iconEmoji, { color: feature.color }]}>
          {feature.icon}
        </Text>
      </LinearGradient>
      <Text style={styles.featureTitle}>{feature.title}</Text>
      <Text style={styles.featureDescription}>{feature.description}</Text>
    </View>
  )
}

function FeaturesSection() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showArrow, setShowArrow] = useState(false)
  const scrollViewRef = useRef(null)
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Load saved index from AsyncStorage
  useEffect(() => {
    const loadSavedIndex = async () => {
      try {
        const savedIndex = await AsyncStorage.getItem('featuresSectionLastIndex')
        if (savedIndex !== null) {
          const index = parseInt(savedIndex, 10)
          if (index >= 0 && index < features.length) {
            setCurrentIndex(index)
            // Scroll to saved position
            setTimeout(() => {
              scrollViewRef.current?.scrollTo({
                x: index * (CARD_WIDTH + CARD_GAP),
                animated: false,
              })
            }, 100)
          }
        }
      } catch (error) {
        console.error('Error loading saved index:', error)
      }
    }
    loadSavedIndex()
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start()
  }, [])

  // Save index to AsyncStorage
  useEffect(() => {
    const saveIndex = async () => {
      try {
        await AsyncStorage.setItem('featuresSectionLastIndex', currentIndex.toString())
      } catch (error) {
        console.error('Error saving index:', error)
      }
    }
    saveIndex()
  }, [currentIndex])

  // Show arrow hint after 2.5 seconds
  useEffect(() => {
    if (currentIndex === 0) {
      const timer = setTimeout(() => {
        setShowArrow(true)
      }, 2500)
      return () => clearTimeout(timer)
    } else {
      setShowArrow(false)
    }
  }, [currentIndex])

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x
    const index = Math.round(scrollPosition / (CARD_WIDTH + CARD_GAP))
    if (index !== currentIndex && index >= 0 && index < features.length) {
      setCurrentIndex(index)
    }
  }

  const scrollToIndex = (index) => {
    scrollViewRef.current?.scrollTo({
      x: index * (CARD_WIDTH + CARD_GAP),
      animated: true,
    })
    setCurrentIndex(index)
  }

  const goToNext = () => {
    if (currentIndex < features.length - 1) {
      scrollToIndex(currentIndex + 1)
    }
  }

  const inspirationCategories = [
    { emoji: '🥙', text: 'Beste Döner' },
    { emoji: '🍕', text: 'Pizza-Topliste' },
    { emoji: '🍔', text: 'Burger-Ranking' },
    { emoji: '🍜', text: 'Asiatisch' },
    { emoji: '🌮', text: 'Mexikanisch' },
    { emoji: '🍣', text: 'Sushi-Guide' },
  ]

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <LinearGradient
        colors={['#FFF7F0', '#FFF0E5']}
        style={styles.background}
      >
        {/* Header */}
        <Text style={styles.header}>
          Entdecke, was Foodspot Ranker kann
        </Text>

        {/* Carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            snapToAlignment="center"
            decelerationRate="fast"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.carouselContent}
          >
            {features.map((feature, index) => (
              <View
                key={feature.id}
                style={[
                  styles.cardWrapper,
                  { width: CARD_WIDTH },
                ]}
              >
                <FeatureCard
                  feature={feature}
                  isActive={index === currentIndex}
                />
              </View>
            ))}
          </ScrollView>

          {/* Arrow Hint */}
          {showArrow && currentIndex < features.length - 1 && (
            <Animated.View
              style={[
                styles.arrowHint,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -8],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Pressable
                style={styles.arrowButton}
                onPress={goToNext}
              >
                <Text style={styles.arrowIcon}>→</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Pagination Dots */}
          <View style={styles.dotsContainer}>
            {features.map((_, index) => (
              <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  style={[
                    styles.dot,
                    index === currentIndex ? styles.dotActive : styles.dotInactive,
                  ]}
                  onPress={() => scrollToIndex(index)}
                />
                {index < features.length - 1 && <View style={{ width: 8 }} />}
              </View>
            ))}
          </View>
        </View>

        {/* Inspiration Section */}
        <View style={styles.inspirationContainer}>
          <Text style={styles.inspirationTitle}>
            💡 Inspiration für deine erste Liste
          </Text>
          <View style={styles.inspirationGrid}>
            {inspirationCategories.map((item, index) => (
              <View key={index} style={{ margin: 6 }}>
                <Pressable
                  style={({ pressed }) => [
                    styles.inspirationCard,
                    pressed === true ? styles.inspirationCardPressed : null,
                  ]}
                >
                  <Text style={styles.inspirationEmoji}>{item.emoji}</Text>
                  <Text style={styles.inspirationText}>{item.text}</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Text style={styles.inspirationHint}>
            Tippe auf eine Kategorie für Inspiration – oder erfinde deine eigene!
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 32,
  },
  background: {
    width: '100%',
    paddingHorizontal: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(44, 44, 44, 0.9)',
    textAlign: 'center',
    marginBottom: 24,
  },
  carouselContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  carouselContent: {
    paddingLeft: (SCREEN_WIDTH - CARD_WIDTH) / 2,
    paddingRight: (SCREEN_WIDTH - CARD_WIDTH) / 2,
  },
  cardWrapper: {
    marginRight: CARD_GAP,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  featureCardActive: {
    shadowColor: '#FF7E42',
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconEmoji: {
    fontSize: 32,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  arrowHint: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#FF7E42',
    fontWeight: 'bold',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  dot: {
    borderRadius: 6,
  },
  dotActive: {
    width: 12,
    height: 12,
    backgroundColor: '#FF7E42',
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: '#D1D5DB',
  },
  inspirationContainer: {
    marginTop: 32,
  },
  inspirationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(44, 44, 44, 0.9)',
    textAlign: 'center',
    marginBottom: 16,
  },
  inspirationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  inspirationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  inspirationCardPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.8,
  },
  inspirationEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  inspirationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  inspirationHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
  },
})

export default FeaturesSection

