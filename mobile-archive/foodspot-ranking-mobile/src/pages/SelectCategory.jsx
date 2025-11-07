import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'

const CATEGORIES = {
  'Döner': {
    emoji: '🥙',
    description: 'Beste Döner-Spots bewerten',
    color: '#FF7E42',
  },
  'Burger': {
    emoji: '🍔',
    description: 'Burger-Ranking erstellen',
    color: '#FFB25A',
  },
  'Pizza': {
    emoji: '🍕',
    description: 'Pizza-Topliste',
    color: '#FF9C68',
  },
  'Asiatisch': {
    emoji: '🍜',
    description: 'Asiatische Küche',
    color: '#FF7E42',
  },
  'Mexikanisch': {
    emoji: '🌮',
    description: 'Mexikanische Gerichte',
    color: '#FFB25A',
  },
  'Glühwein': {
    emoji: '🍷',
    description: 'Glühwein-Stände bewerten',
    color: '#FF9C68',
  },
  'Sushi': {
    emoji: '🍣',
    description: 'Sushi-Restaurants',
    color: '#FF7E42',
  },
  'Dessert': {
    emoji: '🍦',
    description: 'Desserts & Süßes',
    color: '#FFB25A',
  },
  'Vegan/Healthy': {
    emoji: '🥗',
    description: 'Gesunde & vegane Optionen',
    color: '#FF9C68',
  },
}

function SelectCategory() {
  const router = useRouter()
  const { user } = useAuth()

  const handleCategorySelect = (category) => {
    router.push(`/create-list?category=${encodeURIComponent(category)}`)
  }

  const handleAllCategories = () => {
    router.push('/create-list?category=all')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#FFFFFF', '#FFF2EB', '#FFFFFF']}
        style={styles.background}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed === true ? styles.backButtonPressed : null,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Kategorie auswählen</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Main Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>
              Welche Kategorie möchtest du für deine Liste auswählen?
            </Text>
            <Text style={styles.subtitle}>
              Wähle eine spezifische Kategorie oder alle Kategorien für deine Liste
            </Text>
          </View>

          {/* All Categories Option */}
          <Pressable
            style={({ pressed }) => [
              styles.allCategoriesButton,
              pressed === true ? styles.allCategoriesButtonPressed : null,
            ]}
            onPress={handleAllCategories}
          >
            <LinearGradient
              colors={['#FF7E42', '#FFB25A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.allCategoriesGradient}
            >
              <View style={styles.allCategoriesIcon}>
                <Text style={styles.allCategoriesIconText}>➕</Text>
              </View>
              <View style={styles.allCategoriesContent}>
                <Text style={styles.allCategoriesTitle}>Alle Kategorien</Text>
                <Text style={styles.allCategoriesDescription}>
                  Erstelle eine Liste mit Foodspots aller Kategorien – maximale Flexibilität
                </Text>
              </View>
              <Text style={styles.allCategoriesArrow}>→</Text>
            </LinearGradient>
          </Pressable>

          {/* Category Grid */}
          <View style={styles.categoryGrid}>
            {Object.entries(CATEGORIES).map(([category, { emoji, description, color }]) => (
              <Pressable
                key={category}
                style={({ pressed }) => [
                  styles.categoryCard,
                  pressed === true ? styles.categoryCardPressed : null,
                ]}
                onPress={() => handleCategorySelect(category)}
              >
                <LinearGradient
                  colors={[`${color}15`, `${color}25`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.categoryIconContainer}
                >
                  <Text style={styles.categoryEmoji}>{emoji}</Text>
                </LinearGradient>
                <View style={styles.categoryContent}>
                  <Text style={styles.categoryName}>{category}</Text>
                  <Text style={styles.categoryDescription} numberOfLines={2}>
                    {description}
                  </Text>
                </View>
                <Text style={styles.categoryArrow}>→</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  backButtonText: {
    fontSize: 20,
    color: '#374151',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  titleContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  allCategoriesButton: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FF7E42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  allCategoriesButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  allCategoriesGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
  },
  allCategoriesIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  allCategoriesIconText: {
    fontSize: 32,
    color: '#FFFFFF',
  },
  allCategoriesContent: {
    flex: 1,
  },
  allCategoriesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  allCategoriesDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  allCategoriesArrow: {
    fontSize: 24,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryCardPressed: {
    borderColor: '#FF7E42',
    backgroundColor: 'rgba(255, 126, 66, 0.05)',
    transform: [{ scale: 0.98 }],
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryContent: {
    flex: 1,
    minWidth: 0,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  categoryArrow: {
    fontSize: 20,
    color: '#9CA3AF',
    marginLeft: 8,
  },
})

export default SelectCategory

