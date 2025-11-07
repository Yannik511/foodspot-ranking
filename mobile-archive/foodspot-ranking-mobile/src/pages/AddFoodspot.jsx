import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'

function AddFoodspot({ listId, spotId }) {
  const params = useLocalSearchParams()
  const actualListId = listId || params?.id
  const actualSpotId = spotId || params?.spotId

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>Foodspot hinzufügen/bearbeiten</Text>
        <Text style={styles.subtitle}>
          Liste ID: {actualListId}
          {actualSpotId && ` | Spot ID: ${actualSpotId}`}
        </Text>
        <Text style={styles.info}>Migration in Arbeit...</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  info: {
    fontSize: 14,
    color: '#9CA3AF',
  },
})

export default AddFoodspot

